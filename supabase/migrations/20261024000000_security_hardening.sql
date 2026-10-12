-- Security hardening and data-integrity rules, from the full-app audit.
--
-- 1. Function permissions: nothing in the posting machinery is callable by the
--    public (anon) role, and helper / trigger functions are not callable by
--    signed-in users at all (triggers do not need EXECUTE to fire).
-- 2. Supervisors only read what their own screens need. Until now every signed-in
--    user could read the whole ledger, every invoice, staff pay rates and bank
--    accounts straight from the API.
-- 3. Supervisors can no longer approve reimbursements or edit trips.
-- 4. More tables go into the audit log (role changes, clients, vendors, ...).
-- 5. Invoice / vendor-bill numbers cannot be duplicated, amounts cannot be
--    negative, and expense amounts are stored to the paisa.

-- ───────────────────────── 1. Function permissions ─────────────────────────

create or replace function is_back_office() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select role in ('admin', 'cxo') from profiles where id = auth.uid()), false)
$$;

do $$
declare
  f record;
  -- Callable by the app on purpose.
  keep_for_users text[] := array['delete_journal_voucher', 'post_journal_voucher', 'repost_all_invoices', 'next_display_id'];
  -- Internal helpers: only other (owner-run) functions use these.
  internal_only text[] := array['post_gst_lines', 'repost_invoice_entry', 'repost_invoice_payment', 'repost_invoice_note', 'repost_invoice_advance'];
begin
  for f in
    select p.oid, p.proname, p.prorettype = 'trigger'::regtype as is_trigger, p.prosecdef
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.oid::regprocedure);
    if f.is_trigger or f.proname = any(internal_only) then
      execute format('revoke execute on function %s from authenticated', f.oid::regprocedure);
    else
      execute format('grant execute on function %s to authenticated', f.oid::regprocedure);
    end if;
  end loop;
end $$;

-- New functions start private (grant to authenticated explicitly when the app calls them).
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- ───────────────────── 2. Supervisors read only their own scope ─────────────────────

do $$
declare t text;
begin
  -- Back-office only: money, the ledger, bank accounts, payroll.
  foreach t in array array[
    'journal_entries', 'journal_lines', 'invoices', 'invoice_payments', 'invoice_notes',
    'vendor_bills', 'vendor_bill_payments', 'bank_accounts', 'wage_accruals', 'wage_payments',
    'transfers', 'staff_salary_advances'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (is_back_office())', t || '_select', t);
  end loop;
end $$;

drop policy if exists vendors_select on vendors;
create policy vendors_select on vendors for select using (
  is_back_office() or exists (select 1 from expenses e where e.vendor_id = vendors.id and e.created_by = auth.uid())
);

drop policy if exists clients_select on clients;
create policy clients_select on clients for select using (
  is_back_office() or exists (
    select 1 from projects p join supervisor_projects sp on sp.project_id = p.id
    where p.client_id = clients.id and sp.profile_id = auth.uid()
  )
);

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (
  is_back_office()
  or id in (select project_id from supervisor_projects where profile_id = auth.uid())
  or id in (select project_id from expenses where created_by = auth.uid() and project_id is not null)
);

drop policy if exists staff_select on staff;
create policy staff_select on staff for select using (is_back_office() or supervisor_id = auth.uid());

drop policy if exists staff_imprest_transactions_select on staff_imprest_transactions;
create policy staff_imprest_transactions_select on staff_imprest_transactions for select using (
  is_back_office() or profile_id = auth.uid() or created_by = auth.uid()
);

drop policy if exists staff_location_pings_select on staff_location_pings;
create policy staff_location_pings_select on staff_location_pings for select using (is_back_office() or profile_id = auth.uid());
drop policy if exists staff_location_pings_insert on staff_location_pings;
create policy staff_location_pings_insert on staff_location_pings for insert
  with check (profile_id = auth.uid() and current_user_role() in ('admin', 'cxo', 'supervisor'));

-- ───────────────── 3. Reimbursements and trips are not for supervisors to change ─────────────────

drop policy if exists expense_reimbursements_all on expense_reimbursements;
create policy expense_reimbursements_select on expense_reimbursements for select using (
  is_back_office() or exists (select 1 from expenses e where e.id = expense_reimbursements.expense_id and e.created_by = auth.uid())
);
create policy expense_reimbursements_insert on expense_reimbursements for insert with check (is_back_office());
create policy expense_reimbursements_update on expense_reimbursements for update using (is_back_office()) with check (is_back_office());
create policy expense_reimbursements_delete on expense_reimbursements for delete using (is_back_office());

drop policy if exists trips_select on trips;
create policy trips_select on trips for select using (is_back_office() or traveler_id = auth.uid() or created_by = auth.uid());
drop policy if exists trips_insert on trips;
create policy trips_insert on trips for insert with check (is_back_office());
drop policy if exists trips_update on trips;
create policy trips_update on trips for update using (is_back_office()) with check (is_back_office());

-- ───────────────────────── 4. Wider audit trail ─────────────────────────

do $$
declare t text;
begin
  foreach t in array array['profiles', 'clients', 'vendors', 'projects', 'staff', 'bank_accounts', 'trips', 'cost_centers'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'id') then
      execute format('drop trigger if exists trg_audit_update on %I', t);
      execute format('drop trigger if exists trg_audit_delete on %I', t);
      execute format('create trigger trg_audit_update after update on %I for each row execute function audit_row_change()', t);
      execute format('create trigger trg_audit_delete after delete on %I for each row execute function audit_row_change()', t);
    end if;
  end loop;
end $$;

-- ───────────────────────── 5. Data-integrity rules ─────────────────────────

-- New or changed numbers must be unique. Rows already in the books are left
-- alone (a duplicate already exists and is fixed by hand), so this is a trigger
-- and not a unique index.
create or replace function guard_unique_invoice_number() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then return new; end if;
  if tg_op = 'UPDATE' and new.invoice_number is not distinct from old.invoice_number then return new; end if;
  if exists (
    select 1 from invoices i
    where i.id <> new.id and lower(btrim(i.invoice_number)) = lower(btrim(new.invoice_number))
  ) then
    raise exception 'Invoice number % is already used by another invoice.', new.invoice_number using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_unique_invoice_number on invoices;
create trigger trg_unique_invoice_number before insert or update on invoices
  for each row execute function guard_unique_invoice_number();

create or replace function guard_unique_vendor_bill_number() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.vendor_invoice_no is null or btrim(new.vendor_invoice_no) = '' then return new; end if;
  if tg_op = 'UPDATE' and new.vendor_invoice_no is not distinct from old.vendor_invoice_no and new.vendor_id is not distinct from old.vendor_id then return new; end if;
  if exists (
    select 1 from vendor_bills b
    where b.id <> new.id and b.vendor_id is not distinct from new.vendor_id
      and lower(btrim(b.vendor_invoice_no)) = lower(btrim(new.vendor_invoice_no))
  ) then
    raise exception 'This vendor already has a bill numbered %.', new.vendor_invoice_no using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_unique_vendor_bill_number on vendor_bills;
create trigger trg_unique_vendor_bill_number before insert or update on vendor_bills
  for each row execute function guard_unique_vendor_bill_number();

-- Amounts cannot be negative (all existing rows already satisfy this).
alter table invoices drop constraint if exists invoices_amount_nonneg;
alter table invoices add constraint invoices_amount_nonneg check (amount >= 0 and coalesce(gst_pct, 0) >= 0 and coalesce(tds_pct, 0) >= 0) not valid;
alter table expenses drop constraint if exists expenses_amount_nonneg;
alter table expenses add constraint expenses_amount_nonneg check (amount >= 0 and coalesce(gst_pct, 0) >= 0) not valid;
alter table vendor_bills drop constraint if exists vendor_bills_amount_nonneg;
alter table vendor_bills add constraint vendor_bills_amount_nonneg check (amount >= 0 and coalesce(gst_pct, 0) >= 0) not valid;
alter table invoice_payments drop constraint if exists invoice_payments_amount_pos;
alter table invoice_payments add constraint invoice_payments_amount_pos check (amount > 0) not valid;
alter table vendor_bill_payments drop constraint if exists vendor_bill_payments_amount_pos;
alter table vendor_bill_payments add constraint vendor_bill_payments_amount_pos check (amount > 0) not valid;

-- Expenses are stored to the paisa, and so are the GST amounts posted from them.
create or replace function round_expense_amounts() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.amount := round(new.amount, 2);
  if new.additional_amount is not null then new.additional_amount := round(new.additional_amount, 2); end if;
  return new;
end;
$$;
drop trigger if exists trg_round_amount on expenses;
create trigger trg_round_amount before insert or update on expenses
  for each row execute function round_expense_amounts();

create or replace function post_expense() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_entry_id uuid;
  v_gst numeric;
  v_total numeric;
begin
  delete from journal_lines
  where entry_id in (
    select id from journal_entries where source_table = 'expenses' and source_id = NEW.id
  );

  if NEW.sub_head_id is null or NEW.status is distinct from 'approved' then
    delete from journal_entries where source_table = 'expenses' and source_id = NEW.id;
    return NEW;
  end if;

  v_gst := round(NEW.amount * coalesce(NEW.gst_pct, 0) / 100, 2);
  v_total := round(NEW.amount, 2) + v_gst;

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.date, 'Expense — ' || coalesce(NEW.display_id, NEW.description), 'expenses', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, sub_head_id, cost_center, trip_id) values
    (v_entry_id, expense_gl_account(NEW.sub_head_id), round(NEW.amount, 2), 0, NEW.project_id, NEW.sub_head_id, NEW.cost_center, NEW.trip_id);

  if v_gst > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, cost_center, trip_id) values
      (v_entry_id, gl_acct('1050'), v_gst, 0, NEW.project_id, NEW.cost_center, NEW.trip_id);
  end if;

  if NEW.reimbursable then
    insert into journal_lines (entry_id, gl_account_id, debit, credit) values
      (v_entry_id, gl_acct('2020'), 0, v_total);
  elsif NEW.paid_from_imprest then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, profile_id) values
      (v_entry_id, gl_acct('1060'), 0, v_total, NEW.created_by);
  else
    insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
      (v_entry_id, cash_or_bank(NEW.bank_account_id), 0, v_total, NEW.bank_account_id);
  end if;
  return NEW;
end;
$$;
revoke execute on function post_expense() from public, anon, authenticated;
