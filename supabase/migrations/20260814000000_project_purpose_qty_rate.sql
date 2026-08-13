-- Project-scoped expense detail: a "Purpose" (what the money is for) with
-- its own tag list per purpose — mirrors cost_centers.tags, feeding future
-- KPI calculations — plus a Qty x Rate + Additional Amount breakdown that
-- replaces the plain Amount field only when the Projects cost center is
-- selected. Every other cost center keeps the simple single Amount entry.

create table expense_purposes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table expense_purposes enable row level security;

create policy "expense_purposes_select" on expense_purposes for select using (auth.role() = 'authenticated');
create policy "expense_purposes_insert" on expense_purposes for insert with check (is_admin());
create policy "expense_purposes_update" on expense_purposes for update using (is_admin());
create policy "expense_purposes_delete" on expense_purposes for delete using (is_admin());

grant select, insert, update, delete on expense_purposes to authenticated;

insert into expense_purposes (name, sort_order) values ('ADMIN', 1), ('LABOR', 2), ('PR', 3), ('MISC', 4);

create table expense_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table expense_units enable row level security;

-- Mirrors expense_types' pattern: any authenticated user can add a new
-- unit inline while entering an expense, only admin removes one.
create policy "expense_units_select" on expense_units for select using (auth.role() = 'authenticated');
create policy "expense_units_insert" on expense_units for insert with check (auth.role() = 'authenticated');
create policy "expense_units_delete" on expense_units for delete using (is_admin());

grant select, insert, delete on expense_units to authenticated;

insert into expense_units (name) values ('Nos');

-- amount stays the stored total for every downstream due/report/export
-- calculation (qty*rate + additional_amount, computed client-side on
-- submit) — these columns are supplementary job-costing detail, populated
-- only for Projects-cost-center expenses.
alter table expenses add column purpose text;
alter table expenses add column qty numeric;
alter table expenses add column unit text;
alter table expenses add column rate numeric;
alter table expenses add column additional_amount numeric;
