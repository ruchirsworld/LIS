-- A Supervisor's own attendance entry starts 'pending'; once an Admin/CXO
-- marks it 'approved' (HR > Attendance), it must be locked from further
-- Supervisor edits. This was previously only enforced by hiding the edit
-- UI (SupervisorDashboardPage.tsx) -- a direct API call could still bypass
-- it. Admin/CXO retain unrestricted access. Insert is tightened too, so a
-- Supervisor can never write a pre-approved row themselves.

drop policy if exists staff_attendance_update on staff_attendance;
create policy staff_attendance_update on staff_attendance
for update
using (
  current_user_role() = any (array['admin', 'cxo']::user_role[])
  or (current_user_role() = 'supervisor'::user_role and status <> 'approved')
)
with check (
  current_user_role() = any (array['admin', 'cxo']::user_role[])
  or (current_user_role() = 'supervisor'::user_role and status <> 'approved')
);

drop policy if exists staff_attendance_delete on staff_attendance;
create policy staff_attendance_delete on staff_attendance
for delete
using (
  current_user_role() = any (array['admin', 'cxo']::user_role[])
  or (current_user_role() = 'supervisor'::user_role and status <> 'approved')
);

drop policy if exists staff_attendance_insert on staff_attendance;
create policy staff_attendance_insert on staff_attendance
for insert
with check (
  current_user_role() = any (array['admin', 'cxo']::user_role[])
  or (current_user_role() = 'supervisor'::user_role and status <> 'approved')
);
