-- Deleting a salary advance un-does it entirely — restrict to Admin only,
-- matching the same precedent already used for Imprest transactions,
-- Trips, and Expenses. Update stays admin/cxo (unchanged) since correcting
-- a typo is lower-stakes than removing the record outright.
drop policy staff_salary_advances_delete on staff_salary_advances;

create policy staff_salary_advances_delete on staff_salary_advances
for delete
using (current_user_role() = 'admin'::user_role);
