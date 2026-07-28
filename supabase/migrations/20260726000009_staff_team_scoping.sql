-- Staff get view-only access to the Team tab: Attendance is filtered to
-- their own linked employee record, Team Tracker has no per-employee link
-- in its data model so it stays visible unfiltered (still read-only for
-- Staff). Admin/CXO are unaffected — full CRUD on both, same as before.

create or replace function current_user_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from profiles where id = auth.uid()
$$;

-- attendance
drop policy "attendance_all" on attendance;

create policy "attendance_select" on attendance for select
  using (
    current_user_role() in ('admin', 'cxo')
    or employee_id = current_user_employee_id()
  );
create policy "attendance_insert" on attendance for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "attendance_update" on attendance for update
  using (current_user_role() in ('admin', 'cxo'));
create policy "attendance_delete" on attendance for delete
  using (current_user_role() in ('admin', 'cxo'));

-- team_tracker: no per-employee data to filter by, so Staff sees everything,
-- just without write access.
drop policy "team_tracker_all" on team_tracker;

create policy "team_tracker_select" on team_tracker for select
  using (auth.role() = 'authenticated');
create policy "team_tracker_insert" on team_tracker for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "team_tracker_update" on team_tracker for update
  using (current_user_role() in ('admin', 'cxo'));
create policy "team_tracker_delete" on team_tracker for delete
  using (current_user_role() in ('admin', 'cxo'));

-- team_tracker_payments: same split as team_tracker itself.
drop policy "team_tracker_payments_all" on team_tracker_payments;

create policy "team_tracker_payments_select" on team_tracker_payments for select
  using (auth.role() = 'authenticated');
create policy "team_tracker_payments_insert" on team_tracker_payments for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "team_tracker_payments_update" on team_tracker_payments for update
  using (current_user_role() in ('admin', 'cxo'));
create policy "team_tracker_payments_delete" on team_tracker_payments for delete
  using (current_user_role() in ('admin', 'cxo'));
