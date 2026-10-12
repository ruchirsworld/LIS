-- Bank reconciliation: which ledger lines of a bank account have been seen
-- clearing on the bank's statement. A line that is edited or re-posted loses
-- its tick (the row goes with the old line), so a changed payment has to be
-- checked against the statement again.
create table if not exists bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  journal_line_id uuid not null unique references journal_lines(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id),
  cleared_on date not null,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists bank_reconciliations_bank_idx on bank_reconciliations (bank_account_id);
create index if not exists bank_reconciliations_created_by_idx on bank_reconciliations (created_by);

alter table bank_reconciliations enable row level security;
create policy bank_reconciliations_select on bank_reconciliations for select using (is_back_office());
create policy bank_reconciliations_insert on bank_reconciliations for insert with check (is_back_office());
create policy bank_reconciliations_delete on bank_reconciliations for delete using (is_back_office());

create trigger trg_audit_delete after delete on bank_reconciliations for each row execute function audit_row_change();
