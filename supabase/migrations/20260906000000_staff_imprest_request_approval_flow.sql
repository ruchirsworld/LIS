-- Let a supervisor request an advance from their own screen; it only
-- posts to the ledger once an Admin/CXO approves it. Mirrors the existing
-- expenses guard_expense_status()/post_expense() pattern exactly.

alter table staff_imprest_transactions
  add column status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));

create or replace function guard_staff_imprest_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]) then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.status := 'pending';
  else
    NEW.status := OLD.status;
  end if;
  return NEW;
end;
$function$;

create trigger trg_guard_staff_imprest_status
before insert or update on staff_imprest_transactions
for each row execute function guard_staff_imprest_status();

create or replace function post_staff_imprest_transaction()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'staff_imprest_transactions' and source_id = NEW.id);

  if NEW.status is distinct from 'approved' then
    delete from journal_entries where source_table = 'staff_imprest_transactions' and source_id = NEW.id;
    return NEW;
  end if;

  insert into journal_entries (date, description, source_table, source_id)
  values (
    NEW.date,
    (case when NEW.kind = 'advance' then 'Site imprest advance — ' else 'Site imprest return — ' end) || coalesce(NEW.display_id, ''),
    'staff_imprest_transactions',
    NEW.id
  )
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  if NEW.kind = 'advance' then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, profile_id) values
      (v_entry_id, gl_acct('1060'), NEW.amount, 0, NEW.profile_id);
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, NEW.amount, NEW.bank_account_id);
  else
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), NEW.amount, 0, NEW.bank_account_id);
    insert into journal_lines (entry_id, gl_account_id, debit, credit, profile_id) values
      (v_entry_id, gl_acct('1060'), 0, NEW.amount, NEW.profile_id);
  end if;
  return NEW;
end;
$function$;

drop policy if exists staff_imprest_transactions_insert on staff_imprest_transactions;
create policy staff_imprest_transactions_insert on staff_imprest_transactions
for insert
with check (
  current_user_role() = any (array['admin'::user_role, 'cxo'::user_role])
  or (current_user_role() = 'supervisor'::user_role and profile_id = auth.uid() and kind = 'advance')
);
