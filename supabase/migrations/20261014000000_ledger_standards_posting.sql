-- Ledger brought in line with Indian accounting practice (posting side).
--
--  * Company profile (name, GSTIN, PAN, address, state, books-locked-until).
--  * Separate GL accounts: Retention Receivable (1035), Advances from
--    Customers (2060), Output CGST/SGST/IGST Payable (2031-2033). 2030 stays
--    as the catch-all for GST where the place of supply is not known.
--  * Invoice amounts, GST and TDS are held to the paisa.
--  * Invoice posting: GST split by place of supply, retention to its own
--    account. Receipts dated before the invoice are advances until the
--    invoice date, then adjusted against the receivable.
--  * Period lock: nothing dated on or before books_locked_until can be posted,
--    changed or removed.
--  * Posting keeps the same journal entry (and so its JE number) when an
--    invoice or receipt is edited — only its lines are replaced.

-- ── Company profile ───────────────────────────────────────────────────────
create table if not exists company_profile (
  id uuid primary key default gen_random_uuid(),
  name text,
  gstin text,
  pan text,
  address text,
  state_code text,
  books_locked_until date,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into company_profile (name)
select 'Laavin InfraScapes' where not exists (select 1 from company_profile);

alter table company_profile enable row level security;
drop policy if exists company_profile_select on company_profile;
create policy company_profile_select on company_profile for select using (auth.role() = 'authenticated');
drop policy if exists company_profile_update on company_profile;
create policy company_profile_update on company_profile for update
  using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

drop trigger if exists trg_audit_update on company_profile;
create trigger trg_audit_update after update on company_profile for each row execute function audit_row_change();

-- ── GL accounts ───────────────────────────────────────────────────────────
insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select v.code, v.name, v.account_type, v.normal_balance,
       coalesce((select sort_order from gl_accounts where code = v.near), 0)
from (values
  ('1035', 'Retention Receivable',        'asset',     'debit',  '1030'),
  ('2031', 'Output CGST Payable',         'liability', 'credit', '2030'),
  ('2032', 'Output SGST Payable',         'liability', 'credit', '2030'),
  ('2033', 'Output IGST Payable',         'liability', 'credit', '2030'),
  ('2060', 'Advances from Customers',     'liability', 'credit', '2050')
) as v(code, name, account_type, normal_balance, near)
where not exists (select 1 from gl_accounts g where g.code = v.code);

-- ── Paisa precision ───────────────────────────────────────────────────────
create or replace function round_amount_2dp() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.amount := round(new.amount, 2);
  return new;
end;
$$;
drop trigger if exists trg_round_amount on invoices;
create trigger trg_round_amount before insert or update on invoices for each row execute function round_amount_2dp();
drop trigger if exists trg_round_amount on invoice_payments;
create trigger trg_round_amount before insert or update on invoice_payments for each row execute function round_amount_2dp();

-- GST, TDS and retention are rounded to the paisa, exactly as they are posted.
create or replace view v_invoice_computed as
select
  id, display_id, client_id, project_id, amount, gst_pct, tds_pct, due_date_manual, due_days, invoice_date, status, created_by, created_at,
  round(amount * gst_pct / 100::numeric, 2) as gst_amt,
  round(amount * tds_pct / 100::numeric, 2) as tds_amt,
  (amount + round(amount * gst_pct / 100::numeric, 2) - round(amount * tds_pct / 100::numeric, 2)) as net_payable,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0::numeric) as total_paid,
  case
    when due_days is not null and invoice_date is not null then invoice_date + due_days
    else due_date_manual
  end as effective_due_date,
  retention_pct,
  round((amount + round(amount * gst_pct / 100::numeric, 2) - round(amount * tds_pct / 100::numeric, 2)) * retention_pct / 100::numeric, 2) as retention_amount,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id and p.is_retention_release), 0::numeric) as released_paid
from invoices i;
alter view v_invoice_computed set (security_invoker = true);

-- ── Place of supply helpers ───────────────────────────────────────────────
create or replace function company_state_code() returns text
language sql stable set search_path to 'public' as $$
  select case
    when upper(trim(gstin)) ~ '^[0-9]{2}' then substr(upper(trim(gstin)), 1, 2)
    else nullif(trim(state_code), '')
  end
  from company_profile limit 1
$$;

create or replace function client_state_code(p_client uuid) returns text
language sql stable set search_path to 'public' as $$
  select case when upper(trim(gst)) ~ '^[0-9]{2}' then substr(upper(trim(gst)), 1, 2) end
  from clients where id = p_client
$$;

-- ── Receipt posting ───────────────────────────────────────────────────────
create or replace function repost_invoice_payment(p_id uuid) returns void
language plpgsql set search_path to 'public' as $$
declare
  p invoice_payments%rowtype;
  inv invoices%rowtype;
  v_entry uuid;
  v_credit uuid;
begin
  select * into p from invoice_payments where id = p_id;
  if not found then return; end if;
  select * into inv from invoices where id = p.invoice_id;

  insert into journal_entries (date, description, source_table, source_id)
  values (p.date, 'Payment received — ' || coalesce(p.display_id, ''), 'invoice_payments', p.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;

  -- Retention released -> retention receivable. Money received before the
  -- invoice exists (or is dated) -> an advance from the customer. Otherwise
  -- it settles the receivable.
  v_credit := case
    when p.is_retention_release then gl_acct('1035')
    when inv.status <> 'sent' or inv.invoice_date is null or p.date < inv.invoice_date then gl_acct('2060')
    else gl_acct('1030')
  end;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id, project_id)
  values (v_entry, cash_or_bank(p.bank_account_id), p.amount, 0, p.bank_account_id, inv.project_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, v_credit, 0, p.amount, inv.client_id, inv.project_id);
end;
$$;

-- Moves receipts that came in before the invoice date out of Advances and
-- against the receivable, dated on the invoice date.
create or replace function repost_invoice_advance(p_invoice_id uuid) returns void
language plpgsql set search_path to 'public' as $$
declare
  inv invoices%rowtype;
  v_adv numeric;
  v_entry uuid;
begin
  select * into inv from invoices where id = p_invoice_id;
  if not found or inv.status <> 'sent' or inv.invoice_date is null then
    delete from journal_entries where source_table = 'invoice_advance' and source_id = p_invoice_id;
    return;
  end if;

  select coalesce(sum(amount), 0) into v_adv
  from invoice_payments
  where invoice_id = p_invoice_id and not is_retention_release and date < inv.invoice_date;

  if v_adv <= 0 then
    delete from journal_entries where source_table = 'invoice_advance' and source_id = p_invoice_id;
    return;
  end if;

  insert into journal_entries (date, description, source_table, source_id)
  values (inv.invoice_date, 'Advance adjusted against invoice ' || coalesce(inv.invoice_number, inv.display_id, ''), 'invoice_advance', inv.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, gl_acct('2060'), v_adv, 0, inv.client_id, inv.project_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, gl_acct('1030'), 0, v_adv, inv.client_id, inv.project_id);
end;
$$;

-- ── Invoice posting ───────────────────────────────────────────────────────
create or replace function repost_invoice_entry(p_invoice_id uuid) returns void
language plpgsql set search_path to 'public' as $$
declare
  i invoices%rowtype;
  v_entry uuid;
  v_gst numeric; v_tds numeric; v_net numeric; v_ret numeric;
  v_cgst numeric; v_sgst numeric;
  v_company text; v_client text;
  r record;
begin
  select * into i from invoices where id = p_invoice_id;
  if not found or i.status <> 'sent' or i.invoice_date is null then
    -- Not issued (or gone): nothing in the books for it.
    delete from journal_entries where source_table = 'invoices' and source_id = p_invoice_id;
    for r in select id from invoice_payments where invoice_id = p_invoice_id loop
      perform repost_invoice_payment(r.id);
    end loop;
    perform repost_invoice_advance(p_invoice_id);
    return;
  end if;

  v_gst := round(i.amount * i.gst_pct / 100, 2);
  v_tds := round(i.amount * i.tds_pct / 100, 2);
  v_net := i.amount + v_gst - v_tds;
  v_ret := round(v_net * coalesce(i.retention_pct, 0) / 100, 2);

  insert into journal_entries (date, description, source_table, source_id)
  values (i.invoice_date, 'Invoice ' || coalesce(i.invoice_number, i.display_id, ''), 'invoices', i.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;

  if v_net - v_ret > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1030'), v_net - v_ret, 0, i.project_id, i.client_id);
  end if;
  if v_ret > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1035'), v_ret, 0, i.project_id, i.client_id);
  end if;
  if v_tds > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id)
    values (v_entry, gl_acct('1040'), v_tds, 0, i.client_id);
  end if;
  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id)
  values (v_entry, gl_acct('4010'), 0, i.amount, i.project_id);

  if v_gst > 0 then
    v_company := company_state_code();
    v_client := client_state_code(i.client_id);
    if v_company is not null and v_client is not null then
      if v_company = v_client then
        -- Same state: CGST and SGST in equal halves.
        v_cgst := round(v_gst / 2, 2);
        v_sgst := v_gst - v_cgst;
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry, gl_acct('2031'), 0, v_cgst);
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry, gl_acct('2032'), 0, v_sgst);
      else
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry, gl_acct('2033'), 0, v_gst);
      end if;
    else
      -- Place of supply unknown (company or client GSTIN missing).
      insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry, gl_acct('2030'), 0, v_gst);
    end if;
  end if;

  -- Receipts already booked against this invoice may now fall on a different side
  -- of the invoice date, so they are classified again.
  for r in select id from invoice_payments where invoice_id = p_invoice_id loop
    perform repost_invoice_payment(r.id);
  end loop;
  perform repost_invoice_advance(p_invoice_id);
end;
$$;

create or replace function post_invoice() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  perform repost_invoice_entry(new.id);
  return new;
end;
$$;

-- Deleting an invoice takes its entries out of the books too.
create or replace function unpost_invoice() returns trigger
language plpgsql set search_path to 'public' as $
begin
  delete from journal_entries where source_table in ('invoices', 'invoice_advance') and source_id = old.id;
  return old;
end;
$;
drop trigger if exists trg_unpost_invoice on invoices;
create trigger trg_unpost_invoice after delete on invoices for each row execute function unpost_invoice();

create or replace function post_invoice_payment() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  perform repost_invoice_payment(new.id);
  perform repost_invoice_advance(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform repost_invoice_advance(old.invoice_id);
  end if;
  return new;
end;
$$;

create or replace function unpost_invoice_payment() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  delete from journal_entries where source_table = 'invoice_payments' and source_id = old.id;
  perform repost_invoice_advance(old.invoice_id);
  return old;
end;
$$;

-- ── Period lock ───────────────────────────────────────────────────────────
create or replace function enforce_books_lock() returns trigger
language plpgsql set search_path to 'public' as $$
declare
  v_lock date;
  v_date date;
begin
  select books_locked_until into v_lock from company_profile limit 1;
  if v_lock is not null then
    if tg_table_name = 'journal_entries' then
      if tg_op <> 'DELETE' and new.date <= v_lock then v_date := new.date; end if;
      if tg_op <> 'INSERT' and old.date <= v_lock then v_date := old.date; end if;
    else
      select e.date into v_date from journal_entries e
      where e.id = case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
      if v_date is not null and v_date > v_lock then v_date := null; end if;
    end if;
    if v_date is not null then
      raise exception 'The books are locked up to % — entries dated on or before that cannot be added, changed or removed.',
        to_char(v_lock, 'DD Mon YYYY');
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_books_lock on journal_entries;
create trigger trg_books_lock before insert or update or delete on journal_entries
  for each row execute function enforce_books_lock();
drop trigger if exists trg_books_lock on journal_lines;
create trigger trg_books_lock before insert or update or delete on journal_lines
  for each row execute function enforce_books_lock();
