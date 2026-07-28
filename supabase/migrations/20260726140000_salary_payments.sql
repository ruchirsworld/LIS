-- Payment tracking for the Team tab's Salary calculator: lets a computed
-- month's Net payable be recorded (and later edited/removed) as an actual
-- payment against an employee, mirroring team_tracker_payments.

create table salary_payments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  amount numeric not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table salary_payments enable row level security;

create trigger trg_display_id before insert on salary_payments
  for each row execute function set_display_id('SalPay');

-- Salary is sensitive: everyone authenticated can read (matches employees
-- itself, already broadly readable), but only Admin/CXO can record, edit, or
-- remove a payment — same tier as the rest of the Team tab's write actions.
create policy "salary_payments_select" on salary_payments for select
  using (auth.role() = 'authenticated');
create policy "salary_payments_insert" on salary_payments for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "salary_payments_update" on salary_payments for update
  using (current_user_role() in ('admin', 'cxo'));
create policy "salary_payments_delete" on salary_payments for delete
  using (current_user_role() in ('admin', 'cxo'));

grant select, insert, update, delete on salary_payments to authenticated;
