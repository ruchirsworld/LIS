-- Everyone-tier entities: staff/CXO/admin are all equal (full CRUD), matching
-- the prototype where these screens have no isAdmin() gate anywhere.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  name text not null,
  category text,
  contact_person text,
  phone text,
  gstpan text,
  address text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table vendors enable row level security;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  client_id uuid not null references clients(id) on delete restrict,
  project_id uuid references projects(id) on delete restrict,
  amount numeric not null,
  gst_pct numeric not null default 0,
  tds_pct numeric not null default 0,
  due_date_manual date,
  due_days int,
  invoice_date date, -- set once, the first time status becomes 'sent'
  status invoice_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table invoices enable row level security;

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique, -- shares the "Pay" sequence with vendor_bill_payments and loan_payments
  invoice_id uuid not null references invoices(id) on delete cascade,
  date date not null,
  amount numeric not null,
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table invoice_payments enable row level security;

create table vendor_bills (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  vendor_id uuid not null references vendors(id) on delete restrict,
  description text,
  client_id uuid references clients(id) on delete restrict,
  project_id uuid references projects(id) on delete restrict,
  date date,
  amount numeric not null,
  gst_pct numeric not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table vendor_bills enable row level security;

create table vendor_bill_payments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  bill_id uuid not null references vendor_bills(id) on delete cascade,
  date date not null,
  amount numeric not null,
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table vendor_bill_payments enable row level security;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  description text not null,
  type text not null, -- snapshot of expense_types.name at time of entry
  project_id uuid references projects(id) on delete restrict,
  cost_center text,
  vendor_id uuid references vendors(id) on delete restrict,
  amount numeric not null,
  date date not null,
  reimbursable boolean not null default false,
  geo_lat numeric,
  geo_lng numeric,
  receipt_path text, -- Supabase Storage object path in the 'receipts' bucket
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;

create table loans (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  lender text not null,
  principal numeric not null,
  roi_pct numeric not null,
  date_taken date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table loans enable row level security;

create table loan_payments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  loan_id uuid not null references loans(id) on delete cascade,
  date date not null,
  principal_paid numeric not null default 0,
  interest_paid numeric not null default 0,
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table loan_payments enable row level security;

create table capital_transactions (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  partner_id uuid not null references partners(id) on delete restrict,
  type capital_tx_type not null,
  amount numeric not null,
  date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table capital_transactions enable row level security;

create table attendance (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  employee_id uuid not null references employees(id) on delete restrict,
  date date not null,
  status attendance_status not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table attendance enable row level security;

create table team_tracker (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  date date not null,
  project_id uuid not null references projects(id) on delete restrict,
  supplier text not null,
  qty int,
  rate numeric,
  total numeric,
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table team_tracker enable row level security;
