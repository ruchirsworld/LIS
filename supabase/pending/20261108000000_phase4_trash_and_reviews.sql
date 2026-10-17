-- Phase 4 (additive only). Nothing here updates, deletes or backfills an existing row.
--  1. Trash: records are no longer removed for good. Delete marks a record (deleted_at, deleted_by, delete_reason); it disappears from every
--     list and report, its ledger entry is taken out of the books (exactly as a hard delete did), and an admin can restore it from the Trash.
--     Covers expenses, expense reimbursements, capital, transfers, other receipts, loans and loan payments. Invoices and vendor bills keep
--     their current delete for now (they have advance and retention side effects that need their own design).
--  2. record_reviews: a new table holding "reviewed / checked" ticks, so no existing table is changed for it.

-- 1a. The marker columns (all nullable, empty for every existing row).
do $m$
declare t text;
begin
  foreach t in array array['expenses','expense_reimbursements','capital_transactions','transfers','other_receipts','loans','loan_payments'] loop
    execute format('alter table %I add column if not exists deleted_at timestamptz', t);
    execute format('alter table %I add column if not exists deleted_by uuid references profiles(id)', t);
    execute format('alter table %I add column if not exists delete_reason text', t);
    execute format('create index if not exists %I on %I (deleted_at) where deleted_at is not null', t || '_trashed_idx', t);
  end loop;
end $m$;

-- 1b. A trashed row is invisible to every normal read: lists, reports, the invoker functions (activity_by_user, report_summary…).
do $m$
declare t text; pol record;
begin
  foreach t in array array['expenses','expense_reimbursements','capital_transactions','transfers','other_receipts','loans','loan_payments'] loop
    for pol in select p.polname, pg_get_expr(p.polqual, p.polrelid) as q from pg_policy p where p.polrelid = ('public.' || t)::regclass and p.polcmd = 'r' loop
      execute format('alter policy %I on %I using (deleted_at is null and (%s))', pol.polname, t, pol.q);
    end loop;
  end loop;
end $m$;

-- 1c. The marker can only be changed through the two functions below, never by a direct edit.
create or replace function guard_trash_columns() returns trigger
language plpgsql
as $$
begin
  if (new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by or new.delete_reason is distinct from old.delete_reason)
     and coalesce(current_setting('lis.trash_rpc', true), '') <> 'on' then
    raise exception 'Use Delete or Restore on the record itself.';
  end if;
  return new;
end;
$$;

-- 1d. Taking a trashed record out of the books: the same removal a hard delete did. Runs after the posting triggers, so it has the last word.
create or replace function trash_unpost() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  delete from journal_lines where entry_id in (select id from journal_entries where source_table = tg_table_name and source_id = new.id);
  delete from journal_entries where source_table = tg_table_name and source_id = new.id;
  return new;
end;
$$;

do $m$
declare t text;
begin
  foreach t in array array['expenses','expense_reimbursements','capital_transactions','transfers','other_receipts','loans','loan_payments'] loop
    execute format('drop trigger if exists aa_guard_trash on %I', t);
    execute format('create trigger aa_guard_trash before update on %I for each row execute function guard_trash_columns()', t);
    execute format('drop trigger if exists zz_trash_unpost on %I', t);
    execute format('create trigger zz_trash_unpost after update on %I for each row when (new.deleted_at is not null) execute function trash_unpost()', t);
  end loop;
end $m$;

-- 1e. Delete (admin only). A record matched in bank reconciliation must be un-matched first. Reimbursements go with their expense, loan payments with their loan.
create or replace function trash_record(p_table text, p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rows int;
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin can delete records.';
  end if;
  if p_table <> all (array['expenses','expense_reimbursements','capital_transactions','transfers','other_receipts','loans','loan_payments']) then
    raise exception 'Records of this kind cannot be moved to the Trash.';
  end if;
  if exists (
    select 1 from bank_reconciliations br
    join journal_lines jl on jl.id = br.journal_line_id
    join journal_entries je on je.id = jl.entry_id
    where (je.source_table = p_table and je.source_id = p_id)
       or (p_table = 'expenses' and je.source_table = 'expense_reimbursements' and je.source_id in (select id from expense_reimbursements where expense_id = p_id))
       or (p_table = 'loans' and je.source_table = 'loan_payments' and je.source_id in (select id from loan_payments where loan_id = p_id))
  ) then
    raise exception 'This entry is matched in bank reconciliation. Un-match it first, then delete it.';
  end if;

  perform set_config('lis.trash_rpc', 'on', true);
  execute format('update %I set deleted_at = $1, deleted_by = auth.uid(), delete_reason = $2 where id = $3 and deleted_at is null', p_table)
    using v_now, nullif(trim(p_reason), ''), p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'That record was not found.';
  end if;

  if p_table = 'expenses' then
    update expense_reimbursements set deleted_at = v_now, deleted_by = auth.uid(), delete_reason = nullif(trim(p_reason), '') where expense_id = p_id and deleted_at is null;
  elsif p_table = 'loans' then
    update loan_payments set deleted_at = v_now, deleted_by = auth.uid(), delete_reason = nullif(trim(p_reason), '') where loan_id = p_id and deleted_at is null;
  end if;
end;
$$;

-- 1f. Restore (admin only): the record and whatever went to the Trash with it come back, and the ledger entries are posted again.
create or replace function restore_record(p_table text, p_id uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_at timestamptz;
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin can restore records.';
  end if;
  if p_table <> all (array['expenses','expense_reimbursements','capital_transactions','transfers','other_receipts','loans','loan_payments']) then
    raise exception 'Records of this kind are not in the Trash.';
  end if;
  execute format('select deleted_at from %I where id = $1 and deleted_at is not null', p_table) into v_at using p_id;
  if v_at is null then
    raise exception 'That record is not in the Trash.';
  end if;
  if p_table = 'expense_reimbursements' and exists (select 1 from expenses e join expense_reimbursements r on r.expense_id = e.id where r.id = p_id and e.deleted_at is not null) then
    raise exception 'Restore the expense first.';
  end if;
  if p_table = 'loan_payments' and exists (select 1 from loans l join loan_payments r on r.loan_id = l.id where r.id = p_id and l.deleted_at is not null) then
    raise exception 'Restore the loan first.';
  end if;

  perform set_config('lis.trash_rpc', 'on', true);
  execute format('update %I set deleted_at = null, deleted_by = null, delete_reason = null where id = $1', p_table) using p_id;
  if p_table = 'expenses' then
    update expense_reimbursements set deleted_at = null, deleted_by = null, delete_reason = null where expense_id = p_id and deleted_at = v_at;
  elsif p_table = 'loans' then
    update loan_payments set deleted_at = null, deleted_by = null, delete_reason = null where loan_id = p_id and deleted_at = v_at;
  end if;
end;
$$;

-- 1g. What is in the Trash (admin only). Records that went in together with their parent are listed under the parent.
create or replace function list_trash()
returns table (table_name text, record_id uuid, display_id text, record_date date, amount numeric, description text, deleted_at timestamptz, deleted_by_name text, delete_reason text)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin can see the Trash.';
  end if;
  return query
    select 'expenses'::text, x.id, x.display_id, x.date, x.amount, x.description, x.deleted_at, p.name, x.delete_reason
      from expenses x left join profiles p on p.id = x.deleted_by where x.deleted_at is not null
    union all
    select 'expense_reimbursements', x.id, x.display_id, x.date, x.amount, 'Reimbursement paid', x.deleted_at, p.name, x.delete_reason
      from expense_reimbursements x left join profiles p on p.id = x.deleted_by
      where x.deleted_at is not null and not exists (select 1 from expenses e where e.id = x.expense_id and e.deleted_at = x.deleted_at)
    union all
    select 'capital_transactions', x.id, x.display_id, x.date, x.amount, coalesce(x.notes, x.type::text), x.deleted_at, p.name, x.delete_reason
      from capital_transactions x left join profiles p on p.id = x.deleted_by where x.deleted_at is not null
    union all
    select 'transfers', x.id, x.display_id, x.date, x.amount, coalesce(x.notes, 'Transfer'), x.deleted_at, p.name, x.delete_reason
      from transfers x left join profiles p on p.id = x.deleted_by where x.deleted_at is not null
    union all
    select 'other_receipts', x.id, x.display_id, x.date, x.amount, trim(coalesce(x.payer, '') || ' ' || coalesce(x.kind, '')), x.deleted_at, p.name, x.delete_reason
      from other_receipts x left join profiles p on p.id = x.deleted_by where x.deleted_at is not null
    union all
    select 'loans', x.id, x.display_id, x.date_taken, x.principal, coalesce(x.lender, 'Loan'), x.deleted_at, p.name, x.delete_reason
      from loans x left join profiles p on p.id = x.deleted_by where x.deleted_at is not null
    union all
    select 'loan_payments', x.id, x.display_id, x.date, x.principal_paid + x.interest_paid, coalesce(x.reference, 'Loan payment'), x.deleted_at, p.name, x.delete_reason
      from loan_payments x left join profiles p on p.id = x.deleted_by
      where x.deleted_at is not null and not exists (select 1 from loans l where l.id = x.loan_id and l.deleted_at = x.deleted_at)
    order by 7 desc;
end;
$$;

grant execute on function trash_record(text, uuid, text) to authenticated;
grant execute on function restore_record(text, uuid) to authenticated;
grant execute on function list_trash() to authenticated;

-- 2. Reviewed / checked ticks, for any kind of record.
create table if not exists record_reviews (
  table_name text not null,
  record_id uuid not null,
  reviewed_by uuid references profiles(id) default auth.uid(),
  reviewed_at timestamptz not null default now(),
  primary key (table_name, record_id)
);
create index if not exists record_reviews_by_idx on record_reviews (reviewed_by);
alter table record_reviews enable row level security;
create policy record_reviews_select on record_reviews for select using (is_back_office());
create policy record_reviews_insert on record_reviews for insert with check (is_back_office() and reviewed_by = auth.uid());
create policy record_reviews_delete on record_reviews for delete using (is_back_office());
