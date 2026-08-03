-- Real settlement flow for expense reimbursements, replacing the boolean
-- reimbursable/reimbursed flag with an actual payment record — mirrors
-- vendor_bill_payments (same shared "Pay" sequence), letting a reimbursable
-- expense be paid back over one or more installments with a running due,
-- computed client-side exactly like vendor bill due/paid.

create table expense_reimbursements (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  expense_id uuid not null references expenses(id) on delete cascade,
  date date not null,
  amount numeric not null,
  payment_mode text check (payment_mode in ('UPI', 'Cash', 'Bank')),
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table expense_reimbursements enable row level security;

create trigger trg_display_id before insert on expense_reimbursements
  for each row execute function set_display_id('Pay');

-- Tier B: fully open to any authenticated user, same as expenses itself.
create policy "expense_reimbursements_all" on expense_reimbursements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

grant select, insert, update, delete on expense_reimbursements to authenticated;

-- No historical reimbursed = true rows exist in production at migration
-- time (confirmed by direct query before writing this migration), so
-- nothing needs to be backfilled into expense_reimbursements before this drops.
alter table expenses drop column reimbursed;
