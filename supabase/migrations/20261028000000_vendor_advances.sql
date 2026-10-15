-- Advances paid to vendors before any bill exists.
--
--  * New asset account 1075 "Advances to Suppliers".
--  * vendor_advances: money paid to a vendor with no bill yet. Posts Dr 1075 / Cr cash or bank.
--  * When the vendor's bill is entered, the oldest advance is adjusted against it automatically.
--    The adjustment is a vendor_bill_payments row with payment_mode 'Advance' (and advance_id), so every
--    due, ledger and payment calculation that already counts payments keeps working. It posts
--    Dr 2010 Accounts Payable / Cr 1075 and moves no cash.
--  * The adjustment runs whenever an advance or a bill is added, changed or removed, so it never
--    has to be done by hand. A bill edited down below what an advance covered gives the excess back.

-- ── Account ───────────────────────────────────────────────────────────────
insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select '1075', 'Advances to Suppliers', 'asset', 'debit', coalesce((select sort_order from gl_accounts where code = '1070'), 7)
where not exists (select 1 from gl_accounts where code = '1075');

-- ── The advance itself ────────────────────────────────────────────────────
create table if not exists vendor_advances (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  vendor_id uuid not null references vendors(id),
  date date not null,
  amount numeric not null,
  reference text,
  notes text,
  payment_mode text not null default 'Bank',
  bank_account_id uuid references bank_accounts(id),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vendor_advances_amount_pos check (amount > 0),
  constraint vendor_advances_payment_mode_check check (payment_mode = any (array['UPI'::text, 'NEFT'::text, 'Cash'::text, 'Bank'::text]))
);
create index if not exists vendor_advances_vendor_id_idx on vendor_advances (vendor_id);
create index if not exists vendor_advances_bank_account_id_idx on vendor_advances (bank_account_id);
create index if not exists vendor_advances_created_by_idx on vendor_advances (created_by);

alter table vendor_advances enable row level security;
create policy vendor_advances_select on vendor_advances for select using (is_back_office());
create policy vendor_advances_insert on vendor_advances for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy vendor_advances_update on vendor_advances for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy vendor_advances_delete on vendor_advances for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

-- ── An adjustment is a payment of mode 'Advance' that points at its advance ──
alter table vendor_bill_payments add column if not exists advance_id uuid references vendor_advances(id) on delete cascade;
create index if not exists vendor_bill_payments_advance_id_idx on vendor_bill_payments (advance_id);

alter table vendor_bill_payments drop constraint vendor_bill_payments_payment_mode_check;
alter table vendor_bill_payments add constraint vendor_bill_payments_payment_mode_check
  check (payment_mode = any (array['UPI'::text, 'NEFT'::text, 'Cash'::text, 'Bank'::text, 'Reimbursement'::text, 'Advance'::text]));
alter table vendor_bill_payments add constraint vendor_bill_payments_advance_check
  check ((coalesce(payment_mode, '') = 'Advance') = (advance_id is not null)
         and (coalesce(payment_mode, '') <> 'Advance' or (bank_account_id is null and paid_by is null)));

-- ── Posting ───────────────────────────────────────────────────────────────
create or replace function post_vendor_advance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'vendor_advances' and source_id = NEW.id);

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.date, 'Advance to vendor — ' || coalesce(NEW.display_id, ''), 'vendor_advances', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, vendor_id) values
    (v_entry_id, gl_acct('1075'), NEW.amount, 0, NEW.vendor_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
    (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, NEW.amount, NEW.bank_account_id);
  return NEW;
end;
$function$;

create or replace function unpost_vendor_advance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'vendor_advances' and source_id = OLD.id);
  delete from journal_entries where source_table = 'vendor_advances' and source_id = OLD.id;
  return OLD;
end;
$function$;

-- The payment poster now knows the 'Advance' mode: the vendor is paid from the advance, not from cash.
create or replace function post_vendor_bill_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
  v_vendor_id uuid;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'vendor_bill_payments' and source_id = NEW.id);

  select vendor_id into v_vendor_id from vendor_bills where id = NEW.bill_id;

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.date,
          case when NEW.payment_mode = 'Advance' then 'Advance adjusted — ' else 'Vendor payment — ' end || coalesce(NEW.display_id, ''),
          'vendor_bill_payments', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, vendor_id) values
    (v_entry_id, gl_acct('2010'), NEW.amount, 0, v_vendor_id);

  if NEW.payment_mode = 'Reimbursement' then
    -- Paid out of the employee's pocket: the firm now owes them, to be
    -- settled later through Reimbursement due.
    insert into journal_lines (entry_id, gl_account_id, debit, credit) values
      (v_entry_id, gl_acct('2020'), 0, NEW.amount);
  elsif NEW.payment_mode = 'Advance' then
    -- Settled from money already paid to the vendor: no cash or bank moves.
    insert into journal_lines (entry_id, gl_account_id, debit, credit, vendor_id) values
      (v_entry_id, gl_acct('1075'), 0, NEW.amount, v_vendor_id);
  else
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, NEW.amount, NEW.bank_account_id);
  end if;
  return NEW;
end;
$function$;

-- ── Adjusting advances against bills, oldest advance first ────────────────
create or replace function apply_vendor_advances(p_vendor uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b record;
  a record;
  p record;
  v_payable numeric;
  v_paid numeric;
  v_due numeric;
  v_excess numeric;
  v_remaining numeric;
  v_use numeric;
begin
  perform pg_advisory_xact_lock(hashtext('vendor_advances:' || p_vendor::text));

  -- 1. Give back what a bill no longer needs (it was edited down): newest adjustment first.
  for b in
    select * from vendor_bills where vendor_id = p_vendor and sub_head_id is not null and date is not null order by date, created_at
  loop
    v_payable := b.amount + coalesce(b.other_cost, 0) + round(b.amount * b.gst_pct / 100, 2)
                 - round((b.amount + coalesce(b.other_cost, 0)) * coalesce(b.tds_pct, 0) / 100, 2);
    select coalesce(sum(amount), 0) into v_paid from vendor_bill_payments where bill_id = b.id;
    v_excess := v_paid - v_payable;
    if v_excess > 0.004 then
      for p in
        select * from vendor_bill_payments where bill_id = b.id and payment_mode = 'Advance' order by date desc, created_at desc
      loop
        exit when v_excess <= 0.004;
        if p.amount <= v_excess + 0.004 then
          delete from vendor_bill_payments where id = p.id;
          v_excess := v_excess - p.amount;
        else
          update vendor_bill_payments set amount = p.amount - v_excess where id = p.id;
          v_excess := 0;
        end if;
      end loop;
    end if;
  end loop;

  -- 2. Use what is left of each advance, oldest first, on the oldest bills first.
  for a in
    select va.*, va.amount - coalesce((select sum(x.amount) from vendor_bill_payments x where x.advance_id = va.id), 0) as remaining
    from vendor_advances va where va.vendor_id = p_vendor order by va.date, va.created_at
  loop
    v_remaining := a.remaining;
    continue when v_remaining <= 0.004;
    for b in
      select * from vendor_bills where vendor_id = p_vendor and sub_head_id is not null and date is not null order by date, created_at
    loop
      exit when v_remaining <= 0.004;
      v_payable := b.amount + coalesce(b.other_cost, 0) + round(b.amount * b.gst_pct / 100, 2)
                   - round((b.amount + coalesce(b.other_cost, 0)) * coalesce(b.tds_pct, 0) / 100, 2);
      select coalesce(sum(amount), 0) into v_paid from vendor_bill_payments where bill_id = b.id;
      v_due := v_payable - v_paid;
      continue when v_due <= 0.004;
      v_use := least(v_remaining, v_due);
      insert into vendor_bill_payments (bill_id, date, amount, reference, payment_mode, advance_id)
      values (b.id, greatest(a.date, b.date), v_use, 'Adjusted from advance ' || coalesce(a.display_id, ''), 'Advance', a.id);
      v_remaining := v_remaining - v_use;
    end loop;
  end loop;
end;
$function$;
revoke execute on function apply_vendor_advances(uuid) from public, anon, authenticated;

create or replace function trg_vendor_advance_apply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if TG_OP = 'DELETE' then
    -- The adjustments made from it went with it (cascade); what it covered can now come from other advances.
    perform apply_vendor_advances(OLD.vendor_id);
  else
    perform apply_vendor_advances(NEW.vendor_id);
  end if;
  return null;
end;
$function$;

create or replace function trg_vendor_bill_apply_advances()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if TG_OP = 'DELETE' then
    perform apply_vendor_advances(OLD.vendor_id);
    return null;
  end if;
  if TG_OP = 'UPDATE' and OLD.vendor_id <> NEW.vendor_id then
    -- Adjustments came from the old vendor's advances: undo them, then let both vendors settle again.
    delete from vendor_bill_payments where bill_id = NEW.id and payment_mode = 'Advance';
    perform apply_vendor_advances(OLD.vendor_id);
  end if;
  perform apply_vendor_advances(NEW.vendor_id);
  return null;
end;
$function$;

-- An advance that has been used against bills cannot be cut below what was used, or moved to another vendor.
create or replace function guard_vendor_advance_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_used numeric;
begin
  select coalesce(sum(amount), 0) into v_used from vendor_bill_payments where advance_id = OLD.id;
  if v_used > 0.004 then
    if NEW.vendor_id <> OLD.vendor_id then
      raise exception 'Part of this advance (%) has already been used against bills, so the vendor cannot be changed.', round(v_used, 2);
    end if;
    if NEW.amount < v_used - 0.004 then
      raise exception 'Part of this advance (%) has already been used against bills, so the amount cannot be less than that.', round(v_used, 2);
    end if;
  end if;
  return NEW;
end;
$function$;

-- ── Triggers ──────────────────────────────────────────────────────────────
create trigger trg_display_id before insert on vendor_advances for each row execute function set_display_id('Adv');
create trigger trg_round_amount before insert or update on vendor_advances for each row execute function round_amount_2dp();
create trigger trg_guard_vendor_advance_update before update on vendor_advances for each row execute function guard_vendor_advance_update();
create trigger trg_post_vendor_advance after insert on vendor_advances for each row execute function post_vendor_advance();
create trigger trg_post_vendor_advance_update after update on vendor_advances for each row execute function post_vendor_advance();
create trigger trg_unpost_vendor_advance after delete on vendor_advances for each row execute function unpost_vendor_advance();
create trigger trg_vendor_advance_apply_insert after insert on vendor_advances for each row execute function trg_vendor_advance_apply();
create trigger trg_vendor_advance_apply_update after update on vendor_advances for each row execute function trg_vendor_advance_apply();
create trigger trg_vendor_advance_apply_delete after delete on vendor_advances for each row execute function trg_vendor_advance_apply();
create trigger trg_audit_update after update on vendor_advances for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on vendor_advances for each row execute function audit_row_change();

-- Runs after the bill has posted (and, on delete, after its payments have cascaded away).
create trigger trg_vendor_bill_apply_advances after insert or update or delete on vendor_bills
  for each row execute function trg_vendor_bill_apply_advances();
