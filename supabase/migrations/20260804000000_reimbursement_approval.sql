-- Maker-checker for reimbursements: whoever records a settlement, someone
-- else has to approve it. created_by never got its auth.uid() default when
-- expense_reimbursements was created (missed the pattern from
-- 20260801233000_created_by_default_auth_uid.sql), so every row has been
-- silently NULL — fixed here since the approval check depends on it.
alter table expense_reimbursements alter column created_by set default auth.uid();

alter table expense_reimbursements add column approved_by uuid references profiles(id);
alter table expense_reimbursements add column approved_at timestamptz;

-- Enforced in the database, not just the UI, so it holds even if a client
-- bug or a future integration tries to self-approve.
alter table expense_reimbursements
  add constraint expense_reimbursements_no_self_approval
  check (approved_by is null or approved_by <> created_by);
