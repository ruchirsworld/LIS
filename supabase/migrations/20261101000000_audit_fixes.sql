-- Fixes found in the full audit.
--
--  1. Transfers: deleting one left its entry in the books (the money stayed moved), and editing one never
--     posted again. Now both are handled, and entries left behind by deleted transfers are removed.
--  2. report_summary: "vendor_paid" added up the automatic set-offs from advances (no money moves) and left
--     out advances paid. It now counts bill payments except set-offs, plus advances.
--  3. Loans and loan repayments could be read and changed by ANY signed-in user (including supervisors).
--     Now only Admin and CXO can, like every other money table.
--  4. Trigger functions are no longer callable through the public API.
--  5. Row-level-security checks are evaluated once per query, not once per row.
--  6. Every foreign key has an index, so lookups and deletes stay fast as the books grow.

-- ── 6. An index on every foreign key (first: an index cannot be built after rows were changed in the same step) ──
do $$
declare
  r record;
  idx text;
begin
  for r in
    select c.conrelid::regclass::text as tbl,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colnames
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (select array_agg(x order by ord) from unnest(i.indkey::int2[]) with ordinality t(x, ord) where ord <= array_length(c.conkey, 1)) = c.conkey
      )
  loop
    idx := left('idx_' || replace(r.tbl, 'public.', '') || '_' || r.colnames, 56) || '_fk';
    execute format('create index if not exists %I on %s (%s)', idx, r.tbl, r.cols);
  end loop;
end;
$$;

-- ── 1. Transfers ──────────────────────────────────────────────────────────
create or replace function post_transfer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'transfers' and source_id = NEW.id);

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.date, 'Transfer — ' || coalesce(NEW.display_id, ''), 'transfers', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
    (v_entry_id, cash_or_bank(NEW.to_account_id), NEW.amount, 0, NEW.to_account_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
    (v_entry_id, cash_or_bank(NEW.from_account_id), 0, NEW.amount, NEW.from_account_id);
  return NEW;
end;
$function$;

create or replace function unpost_transfer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'transfers' and source_id = OLD.id);
  delete from journal_entries where source_table = 'transfers' and source_id = OLD.id;
  return OLD;
end;
$function$;

drop trigger if exists trg_post_transfer_update on transfers;
create trigger trg_post_transfer_update after update on transfers for each row execute function post_transfer();
drop trigger if exists trg_unpost_transfer on transfers;
create trigger trg_unpost_transfer after delete on transfers for each row execute function unpost_transfer();

-- Entries left behind by transfers that were deleted before this fix.
delete from journal_lines
where entry_id in (
  select je.id from journal_entries je
  where je.source_table = 'transfers' and not exists (select 1 from transfers t where t.id = je.source_id)
);
delete from journal_entries je
where je.source_table = 'transfers' and not exists (select 1 from transfers t where t.id = je.source_id);

-- ── 2. Paid to vendors, in the summary figures ────────────────────────────
create or replace function report_summary(p_from date default null::date, p_to date default null::date)
returns json
language sql
stable
set search_path to 'public'
as $function$
  select json_build_object(
    'output_gst', coalesce((
      select sum(amount * gst_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.gst_amount else n.gst_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'input_gst', coalesce((
      select sum(amount * gst_pct / 100) from vendor_bills
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'tds_deducted', coalesce((
      select sum(amount * tds_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.tds_amount else n.tds_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'total_invoiced', coalesce((
      select sum(amount + amount * gst_pct / 100 - amount * tds_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.net_amount else n.net_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'total_received', coalesce((
      select sum(amount) from invoice_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'total_expenses', coalesce((
      select sum(amount) from expenses
      where status = 'approved' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'vendor_purchases', coalesce((
      select sum(amount + amount * gst_pct / 100) from vendor_bills
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    -- Money actually paid to vendors: payments on bills (not the set-off of an advance, which moves no money) plus advances.
    'vendor_paid', coalesce((
      select sum(amount) from vendor_bill_payments
      where payment_mode is distinct from 'Advance' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0) + coalesce((
      select sum(amount) from vendor_advances
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_interest_paid', coalesce((
      select sum(interest_paid) from loan_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_principal_paid', coalesce((
      select sum(principal_paid) from loan_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_outstanding_total', coalesce((select sum(outstanding) from v_loan_computed), 0),
    'capital_injected', coalesce((
      select sum(amount) from capital_transactions
      where type = 'injection' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'capital_withdrawn', coalesce((
      select sum(amount) from capital_transactions
      where type = 'withdrawal' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0)
  );
$function$;

-- ── 3. Loans are Admin and CXO only ───────────────────────────────────────
drop policy if exists loans_all on loans;
create policy loans_select on loans for select using (is_back_office());
create policy loans_insert on loans for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy loans_update on loans for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy loans_delete on loans for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

drop policy if exists loan_payments_all on loan_payments;
create policy loan_payments_select on loan_payments for select using (is_back_office());
create policy loan_payments_insert on loan_payments for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy loan_payments_update on loan_payments for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy loan_payments_delete on loan_payments for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

-- ── 4. Trigger functions are not part of the public API ───────────────────
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end;
$$;

-- ── 5. Row-level-security checks run once per query, not once per row ─────
do $$
declare
  r record;
  using_sql text;
  check_sql text;
  calls constant text := '(auth\.uid\(\)|auth\.role\(\)|current_user_role\(\)|is_back_office\(\))';
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    -- Leave alone any policy that does not call these, or already wraps them.
    continue when coalesce(r.qual, '') !~ calls and coalesce(r.with_check, '') !~ calls;
    continue when coalesce(r.qual, '') ~* '\(\s*select\s' or coalesce(r.with_check, '') ~* '\(\s*select\s';
    using_sql := case when r.qual is not null then 'using (' || regexp_replace(r.qual, calls, '(select \1)', 'g') || ')' else '' end;
    check_sql := case when r.with_check is not null then 'with check (' || regexp_replace(r.with_check, calls, '(select \1)', 'g') || ')' else '' end;
    execute format('alter policy %I on %I.%I %s %s', r.policyname, r.schemaname, r.tablename, using_sql, check_sql);
  end loop;
end;
$$;
