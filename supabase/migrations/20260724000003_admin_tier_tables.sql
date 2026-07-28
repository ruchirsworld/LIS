-- Admin-tab entities: admin writes, everyone (authenticated) reads.
-- Mirrors the prototype's Admin tab gate exactly (Clients, Projects, Cost Centers,
-- Expense Types, Partners, Employees, Users).

create table clients (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  name text not null,
  address text,
  gst text,
  email text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table clients enable row level security;

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table cost_centers enable row level security;

-- Expense types: unlike the other admin-tier tables, INSERT is open to everyone
-- (the prototype's inline "+ Add new category" on the expense form has no admin
-- check, even though rename/delete under the Admin tab does). See RLS migration.
create table expense_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table expense_types enable row level security;

create table projects (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  name text not null,
  client_id uuid not null references clients(id) on delete restrict,
  status project_status not null default 'active',
  cost_center text, -- snapshot at time of entry, intentionally not an FK (see spec decision)
  budget numeric,
  value_ex_gst numeric,
  billing_address text,
  same_as_client_address boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table projects enable row level security;

create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table partners enable row level security;

create table employees (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  name text not null,
  designation text,
  phone text,
  daily_rate numeric,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table employees enable row level security;

-- Split out from employees so RLS can hide Aadhar/PAN from non-admins at the
-- row level (Postgres RLS can't do column-level restriction on one table).
create table employee_sensitive (
  employee_id uuid primary key references employees(id) on delete cascade,
  aadhar text,
  pan text
);
alter table employee_sensitive enable row level security;
