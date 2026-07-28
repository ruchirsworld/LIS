-- Bank accounts: Admin-managed master data (Tier A: admin write / everyone
-- read), matching cost_centers/partners.
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_number text,
  opening_balance numeric not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table bank_accounts enable row level security;

create policy "bank_accounts_select" on bank_accounts for select using (auth.role() = 'authenticated');
create policy "bank_accounts_insert" on bank_accounts for insert with check (is_admin());
create policy "bank_accounts_update" on bank_accounts for update using (is_admin());
create policy "bank_accounts_delete" on bank_accounts for delete using (is_admin());

-- Transfers: simple money-movement log, not a full bank reconciliation
-- (Tier B: open to any authenticated user, matching capital_transactions).
-- from_account_id null => source is Cash. to_account_id null => destination
-- is Cash. Both set => bank-to-bank. The two check constraints together rule
-- out "both null" and "transfer to the same account".
create table transfers (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  from_account_id uuid references bank_accounts(id) on delete restrict,
  to_account_id uuid references bank_accounts(id) on delete restrict,
  amount numeric not null,
  date date not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint transfers_accounts_not_both_null check (from_account_id is not null or to_account_id is not null),
  constraint transfers_accounts_distinct check (from_account_id is distinct from to_account_id)
);
alter table transfers enable row level security;

create policy "transfers_all" on transfers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create trigger trg_display_id before insert on transfers for each row execute function set_display_id('Trf');
