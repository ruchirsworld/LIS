-- Who an expense is to be reimbursed to.
--
-- Until now the person owed for a reimbursable expense was always whoever recorded it. An Admin can now name someone else
-- (for example when the Admin entered an expense that a supervisor paid out of pocket). When it is empty, the person who
-- recorded the expense is the one owed, as before. For a vendor payment made in Reimbursement mode the person owed is the
-- existing "paid_by" field.

alter table expenses add column if not exists reimburse_to uuid references profiles(id);
create index if not exists idx_expenses_reimburse_to_fk on expenses (reimburse_to);
