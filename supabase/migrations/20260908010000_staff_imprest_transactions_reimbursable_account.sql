-- Replace the earlier worker-linked "Reimbursement" kind with a simpler
-- "Reimbursement" Account option (alongside Kotak/CBI/Cash) on the existing
-- advance/return kinds: it means the Admin/CXO paid this advance out of
-- their own pocket rather than from a company account, so no cash/bank
-- actually moves and the firm owes it back to them — same treatment as the
-- existing "Reimburse" account on Expenses (credits gl_acct('2020') with no
-- bank/cash line, untagged, pooled with the same liability expenses use).
alter table staff_imprest_transactions
  drop constraint staff_imprest_transactions_kind_check;
alter table staff_imprest_transactions
  add constraint staff_imprest_transactions_kind_check
  check (kind = any (array['advance', 'return']));

alter table staff_imprest_transactions
  add column reimbursable boolean not null default false;

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
    delete from staff_salary_advances where source_table = 'staff_imprest_transactions' and source_id = NEW.id;
    return NEW;
  end if;

  if NEW.kind = 'advance' and NEW.staff_id is not null then
    insert into staff_salary_advances (staff_id, date, amount, bank_account_id, remarks, source_table, source_id, created_by)
    values (NEW.staff_id, NEW.date, NEW.amount, NEW.bank_account_id, NEW.remarks, 'staff_imprest_transactions', NEW.id, NEW.created_by)
    on conflict (source_table, source_id) where source_table is not null do update
      set staff_id = excluded.staff_id, date = excluded.date, amount = excluded.amount,
          bank_account_id = excluded.bank_account_id, remarks = excluded.remarks;
    return NEW;
  end if;

  delete from staff_salary_advances where source_table = 'staff_imprest_transactions' and source_id = NEW.id;

  insert into journal_entries (date, description, source_table, source_id)
  values (
    NEW.date,
    (case when NEW.kind = 'advance' then 'Site imprest advance — ' else 'Site imprest return — ' end) || coalesce(NEW.display_id, ''),
    'staff_imprest_transactions', NEW.id
  )
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  if NEW.kind = 'advance' then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, profile_id) values
      (v_entry_id, gl_acct('1060'), NEW.amount, 0, NEW.profile_id);
    if NEW.reimbursable then
      insert into journal_lines (entry_id, gl_account_id, debit, credit) values
        (v_entry_id, gl_acct('2020'), 0, NEW.amount);
    else
      insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
        (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, NEW.amount, NEW.bank_account_id);
    end if;
  else
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), NEW.amount, 0, NEW.bank_account_id);
    insert into journal_lines (entry_id, gl_account_id, debit, credit, profile_id) values
      (v_entry_id, gl_acct('1060'), 0, NEW.amount, NEW.profile_id);
  end if;
  return NEW;
end;
$function$;
