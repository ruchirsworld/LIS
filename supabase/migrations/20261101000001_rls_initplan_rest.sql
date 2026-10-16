-- The last four row-level-security checks that still ran their permission test once per row. Same rules, written
-- so the user and role are looked up once per query.
alter policy clients_select on clients using (
  (select is_back_office())
  or exists (
    select 1 from projects p join supervisor_projects sp on sp.project_id = p.id
    where p.client_id = clients.id and sp.profile_id = (select auth.uid())
  )
);

alter policy projects_select on projects using (
  (select is_back_office())
  or id in (select supervisor_projects.project_id from supervisor_projects where supervisor_projects.profile_id = (select auth.uid()))
  or id in (select expenses.project_id from expenses where expenses.created_by = (select auth.uid()) and expenses.project_id is not null)
);

alter policy vendors_select on vendors using (
  (select is_back_office())
  or exists (select 1 from expenses e where e.vendor_id = vendors.id and e.created_by = (select auth.uid()))
);

alter policy expense_reimbursements_select on expense_reimbursements using (
  (select is_back_office())
  or exists (select 1 from expenses e where e.id = expense_reimbursements.expense_id and e.created_by = (select auth.uid()))
);
