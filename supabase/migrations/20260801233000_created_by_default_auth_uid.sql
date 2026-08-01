-- created_by has never been populated anywhere in the app — no form sets it
-- and no default/trigger did either, so every existing row is NULL and every
-- "by user" feature (e.g. Reimbursement due by user, Recorded by) silently
-- fell back to "Unknown". auth.uid() is available in every authenticated
-- request via PostgREST (RLS policies already rely on it), so a column
-- default is enough to populate it correctly on every future insert without
-- any frontend changes. Existing NULL rows are left as-is — there's no way
-- to know after the fact who actually entered them.
alter table bank_accounts alter column created_by set default auth.uid();
alter table capital_transactions alter column created_by set default auth.uid();
alter table clients alter column created_by set default auth.uid();
alter table cost_centers alter column created_by set default auth.uid();
alter table expense_categories alter column created_by set default auth.uid();
alter table expenses alter column created_by set default auth.uid();
alter table invoice_payments alter column created_by set default auth.uid();
alter table invoices alter column created_by set default auth.uid();
alter table loan_payments alter column created_by set default auth.uid();
alter table loans alter column created_by set default auth.uid();
alter table projects alter column created_by set default auth.uid();
alter table transfers alter column created_by set default auth.uid();
alter table vendor_bill_payments alter column created_by set default auth.uid();
alter table vendor_bills alter column created_by set default auth.uid();
alter table vendors alter column created_by set default auth.uid();
