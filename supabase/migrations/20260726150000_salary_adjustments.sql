-- Manual salary adjustments (bonus/deduction not captured by attendance —
-- e.g. advance recovery, penalty, one-off bonus), tagged to a specific
-- calendar month and folded into that month's Net payable in the Salary
-- calculator. Positive amount = addition, negative = deduction.

create table salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  employee_id uuid not null references employees(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  amount numeric not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table salary_adjustments enable row level security;

create trigger trg_display_id before insert on salary_adjustments
  for each row execute function set_display_id('SalAdj');

-- Same tier as salary_payments: everyone authenticated can read, only
-- Admin/CXO can record, edit, or remove an adjustment.
create policy "salary_adjustments_select" on salary_adjustments for select
  using (auth.role() = 'authenticated');
create policy "salary_adjustments_insert" on salary_adjustments for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "salary_adjustments_update" on salary_adjustments for update
  using (current_user_role() in ('admin', 'cxo'));
create policy "salary_adjustments_delete" on salary_adjustments for delete
  using (current_user_role() in ('admin', 'cxo'));

grant select, insert, update, delete on salary_adjustments to authenticated;
