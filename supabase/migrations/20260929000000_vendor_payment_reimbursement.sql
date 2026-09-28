-- Vendor payments can be made by an employee out of pocket ("Reimbursement"):
-- the vendor's due drops, no cash/bank moves, and the firm owes that employee.
alter table vendor_bill_payments add column paid_by uuid references profiles(id);

alter table vendor_bill_payments drop constraint vendor_bill_payments_payment_mode_check;
alter table vendor_bill_payments add constraint vendor_bill_payments_payment_mode_check
  check (payment_mode = any (array['UPI'::text, 'NEFT'::text, 'Cash'::text, 'Bank'::text, 'Reimbursement'::text]));
alter table vendor_bill_payments add constraint vendor_bill_payments_reimbursement_check
  check (payment_mode is distinct from 'Reimbursement' or (paid_by is not null and bank_account_id is null));

create or replace function post_vendor_bill_payment()
returns trigger
language plpgsql
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
  values (NEW.date, 'Vendor payment — ' || coalesce(NEW.display_id, ''), 'vendor_bill_payments', NEW.id)
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
  else
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, NEW.amount, NEW.bank_account_id);
  end if;
  return NEW;
end;
$function$;

-- Settling what the firm owes an employee can now point at a reimbursed
-- vendor payment instead of an expense (exactly one of the two).
alter table expense_reimbursements alter column expense_id drop not null;
alter table expense_reimbursements
  add column vendor_bill_payment_id uuid references vendor_bill_payments(id) on delete cascade;
alter table expense_reimbursements
  add constraint expense_reimbursements_one_source_check
  check ((expense_id is not null) <> (vendor_bill_payment_id is not null));
create index idx_expense_reimbursements_vendor_bill_payment_id on expense_reimbursements(vendor_bill_payment_id);
