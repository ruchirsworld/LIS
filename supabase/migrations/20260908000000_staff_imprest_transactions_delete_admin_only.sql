-- Deleting an imprest transaction is a heavier action than editing one
-- (it also un-posts the linked GL entry entirely) -- restrict it to Admin
-- only, unlike every other action on this table which is admin/cxo.
drop policy if exists staff_imprest_transactions_delete on staff_imprest_transactions;
create policy staff_imprest_transactions_delete on staff_imprest_transactions
for delete
using (current_user_role() = 'admin'::user_role);
