-- Deleting an expense record is a heavier action than editing it — restrict
-- it to Admin only, matching the same precedent already used for Imprest
-- transactions and Trips. The prior policy also let CXO delete and let
-- anyone delete their own row (created_by = auth.uid()) — that self-delete
-- clause was never actually exercised by any UI (Supervisors only ever
-- edit their own pending claim's amount, never delete it), so dropping it
-- doesn't remove a real capability, just an unused one.
drop policy expenses_delete on expenses;

create policy expenses_delete on expenses
for delete
using (current_user_role() = 'admin'::user_role);
