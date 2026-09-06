-- A small, extensible key/value store for admin/cxo-tunable numeric
-- thresholds (starting with the Food/Transport soft-warning amount on a
-- Supervisor's Project expense claim) — avoids a schema migration every
-- time a new tunable value is needed.
create table app_settings (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

insert into app_settings (key, value) values ('team_expense_warning_threshold', 500);

alter table app_settings enable row level security;

create policy app_settings_select on app_settings
for select
using (auth.role() = 'authenticated');

create policy app_settings_update on app_settings
for update
using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
