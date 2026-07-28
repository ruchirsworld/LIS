-- Payment tracking for Team Tracker entries, added on request: mirrors
-- invoice_payments / vendor_bill_payments (same shared "Pay" sequence),
-- letting a team_tracker.total be paid off over time with a running due.

create table team_tracker_payments (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  team_tracker_id uuid not null references team_tracker(id) on delete cascade,
  date date not null,
  amount numeric not null,
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table team_tracker_payments enable row level security;

create trigger trg_display_id before insert on team_tracker_payments
  for each row execute function set_display_id('Pay');

-- Tier B: fully open to any authenticated user, same as team_tracker itself.
create policy "team_tracker_payments_all" on team_tracker_payments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

grant select, insert, update, delete on team_tracker_payments to authenticated;
