-- A saved sign-off for a bank reconciliation: "this account was reconciled to this statement
-- date, with these figures, by this person". The ticks themselves are saved as they are made
-- (bank_reconciliations); this records that the reconciliation was finished and confirmed.
create table if not exists bank_reconciliation_signoffs (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id),
  statement_date date not null,
  statement_balance numeric not null,
  book_balance numeric not null,
  uncleared_deposits numeric not null default 0,
  uncleared_withdrawals numeric not null default 0,
  difference numeric not null default 0,
  note text,
  completed_by uuid references profiles(id) default auth.uid(),
  completed_at timestamptz not null default now(),
  unique (bank_account_id, statement_date)
);
create index if not exists bank_reconciliation_signoffs_completed_by_idx on bank_reconciliation_signoffs (completed_by);

alter table bank_reconciliation_signoffs enable row level security;
create policy bank_reconciliation_signoffs_select on bank_reconciliation_signoffs for select using (is_back_office());
create policy bank_reconciliation_signoffs_insert on bank_reconciliation_signoffs for insert with check (is_back_office());
create policy bank_reconciliation_signoffs_update on bank_reconciliation_signoffs for update using (is_back_office()) with check (is_back_office());
create policy bank_reconciliation_signoffs_delete on bank_reconciliation_signoffs for delete using (is_back_office());

create trigger trg_audit_update after update on bank_reconciliation_signoffs for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on bank_reconciliation_signoffs for each row execute function audit_row_change();
