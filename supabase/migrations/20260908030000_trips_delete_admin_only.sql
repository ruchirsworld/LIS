-- Deleting a trip is a heavier action than editing it (any expenses still
-- logged against it will keep the delete from succeeding entirely, via the
-- plain FK on expenses.trip_id) — restrict it to Admin only, matching the
-- same admin-only-delete precedent already used for Imprest transactions.
-- The single trips_all policy covered every command permissively for any
-- authenticated user, so it has to be split rather than simply adding a
-- stricter delete policy alongside it (permissive policies OR together).
drop policy trips_all on trips;

create policy trips_select on trips
for select
using (auth.role() = 'authenticated'::text);

create policy trips_insert on trips
for insert
with check (auth.role() = 'authenticated'::text);

create policy trips_update on trips
for update
using (auth.role() = 'authenticated'::text);

create policy trips_delete on trips
for delete
using (current_user_role() = 'admin'::user_role);
