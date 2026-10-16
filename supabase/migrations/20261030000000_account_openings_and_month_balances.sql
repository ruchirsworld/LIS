-- Opening balances for cash and bank accounts, and the bank statement's balance at the start of each month.
--
--  * account_openings: the balance an account had on the day the books for it start. It is posted to the
--    ledger (Dr cash or bank, Cr Opening Balance Equity 3020) so Cash & bank, the Dashboard, Bank reconciliation
--    and the negative-balance check all include it. One per account; a negative amount is an overdraft.
--  * account_month_balances: what the bank statement (or the cash book) shows at the start of a month. Never
--    posted: it is only used to check that the entries made for each month add up to the statement.

-- ── Account ───────────────────────────────────────────────────────────────
insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select '3020', 'Opening Balance Equity', 'equity', 'credit', coalesce((select sort_order from gl_accounts where code = '3010'), 20)
where not exists (select 1 from gl_accounts where code = '3020');

-- ── Opening balances ──────────────────────────────────────────────────────
create table if not exists account_openings (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references bank_accounts(id),  -- null = Cash in hand
  as_on date not null,
  amount numeric not null,
  notes text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists account_openings_one_per_account
  on account_openings ((coalesce(bank_account_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create index if not exists account_openings_bank_account_id_idx on account_openings (bank_account_id);
create index if not exists account_openings_created_by_idx on account_openings (created_by);

alter table account_openings enable row level security;
create policy account_openings_select on account_openings for select using (is_back_office());
create policy account_openings_insert on account_openings for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy account_openings_update on account_openings for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy account_openings_delete on account_openings for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

create or replace function post_account_opening()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
  v_name text;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'account_openings' and source_id = NEW.id);

  if NEW.amount = 0 then
    delete from journal_entries where source_table = 'account_openings' and source_id = NEW.id;
    return NEW;
  end if;

  select coalesce((select name from bank_accounts where id = NEW.bank_account_id), 'Cash') into v_name;

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.as_on, 'Opening balance — ' || v_name, 'account_openings', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  if NEW.amount > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), NEW.amount, 0, NEW.bank_account_id);
    insert into journal_lines (entry_id, gl_account_id, debit, credit) values
      (v_entry_id, gl_acct('3020'), 0, NEW.amount);
  else
    -- An overdraft: the account owes the bank, so the books start below zero.
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, -NEW.amount, NEW.bank_account_id);
    insert into journal_lines (entry_id, gl_account_id, debit, credit) values
      (v_entry_id, gl_acct('3020'), -NEW.amount, 0);
  end if;
  return NEW;
end;
$function$;

create or replace function unpost_account_opening()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'account_openings' and source_id = OLD.id);
  delete from journal_entries where source_table = 'account_openings' and source_id = OLD.id;
  return OLD;
end;
$function$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  NEW.updated_at := now();
  return NEW;
end;
$function$;

create trigger trg_touch_updated_at before update on account_openings for each row execute function touch_updated_at();
create trigger trg_post_account_opening after insert on account_openings for each row execute function post_account_opening();
create trigger trg_post_account_opening_update after update on account_openings for each row execute function post_account_opening();
create trigger trg_unpost_account_opening after delete on account_openings for each row execute function unpost_account_opening();
create trigger trg_audit_update after update on account_openings for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on account_openings for each row execute function audit_row_change();

-- ── Statement balances at the start of each month ─────────────────────────
create table if not exists account_month_balances (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references bank_accounts(id),  -- null = Cash in hand
  month date not null,
  balance numeric not null,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_month_balances_first_of_month check (extract(day from month) = 1)
);
create unique index if not exists account_month_balances_one_per_month
  on account_month_balances ((coalesce(bank_account_id, '00000000-0000-0000-0000-000000000000'::uuid)), month);
create index if not exists account_month_balances_bank_account_id_idx on account_month_balances (bank_account_id);
create index if not exists account_month_balances_created_by_idx on account_month_balances (created_by);

alter table account_month_balances enable row level security;
create policy account_month_balances_select on account_month_balances for select using (is_back_office());
create policy account_month_balances_insert on account_month_balances for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy account_month_balances_update on account_month_balances for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy account_month_balances_delete on account_month_balances for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

create trigger trg_touch_updated_at before update on account_month_balances for each row execute function touch_updated_at();
create trigger trg_audit_update after update on account_month_balances for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on account_month_balances for each row execute function audit_row_change();
