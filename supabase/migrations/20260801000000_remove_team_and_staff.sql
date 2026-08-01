-- App is now Admin/CXO-only: remove the Team/Attendance/Salary/Employees
-- module and the Staff role entirely, per explicit request. Confirmed before
-- writing this: no profiles use role='staff', and the only data at stake was
-- 2 test attendance rows and 4 employees (0 team_tracker/salary rows) — all
-- explicitly approved for permanent deletion.

-- handle_new_user must stop referencing employee_id (column is dropped
-- below) and stop defaulting new signups to 'staff'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cxo'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

-- Dashboard KPI view depends on employees (team_members_count) — redefine it
-- first so the table can be dropped below.
drop view v_dashboard_kpis;
create view v_dashboard_kpis
with (security_invoker = true) as
select
  (select coalesce(sum(net_payable - total_paid), 0) from v_invoice_computed) as outstanding_from_clients,
  (select coalesce(sum(amount), 0) from expenses
     where date_trunc('month', date) = date_trunc('month', current_date)) as expenses_this_month,
  (select count(*) from projects where status = 'active') as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(total - paid), 0) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection' then amount else -amount end), 0)
     from capital_transactions) as net_partner_capital;

-- Drop dependent tables first (children before employees itself).
drop table if exists team_tracker_payments;
drop table if exists team_tracker;
drop table if exists salary_payments;
drop table if exists salary_adjustments;
drop table if exists attendance;
drop table if exists employee_sensitive;

alter table profiles drop column employee_id;

drop table if exists employees;

-- current_user_role() stays — vendors_insert still depends on it.
-- current_user_employee_id() was only ever used by attendance_select, which
-- is gone now.
drop function if exists current_user_employee_id();

-- Tidy up now-orphaned id_sequences rows (harmless to leave, but no point
-- keeping counters for prefixes that can never be used again).
delete from id_sequences where prefix in ('Emp', 'Att', 'TT', 'SalPay', 'SalAdj');

-- The 'staff' value stays defined on the user_role enum (Postgres can't drop
-- a single enum value without recreating the type) but is no longer offered
-- anywhere in the app, and no profile can use it going forward.
