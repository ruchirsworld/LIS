-- The ledger can only be written by the posting functions.
--
-- journal_entries / journal_lines used to accept inserts, updates and deletes
-- from any signed-in user, so the books could be changed through the API
-- without going through an invoice, receipt or voucher. Every posting function
-- now runs with its owner's rights (security definer), and the direct-write
-- policies on the two ledger tables are removed.
--
-- The money tables that feed the ledger (invoices, receipts, transfers, vendor
-- bills and their payments) stay readable by every signed-in user but can only
-- be written by an Admin or CXO.
do $$
declare
  r record;
  t text;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and (p.proname like 'post\_%' or p.proname like 'unpost\_%' or p.proname like 'repost\_%') loop
    execute 'alter function ' || r.sig || ' security definer';
  end loop;

  drop policy if exists journal_entries_insert on journal_entries;
  drop policy if exists journal_entries_update on journal_entries;
  drop policy if exists journal_entries_delete on journal_entries;
  drop policy if exists journal_lines_insert on journal_lines;
  drop policy if exists journal_lines_update on journal_lines;
  drop policy if exists journal_lines_delete on journal_lines;

  foreach t in array array['invoices', 'invoice_payments', 'transfers', 'vendor_bills', 'vendor_bill_payments'] loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format('create policy %I on %I for select using (auth.role() = ''authenticated'')', t || '_select', t);
    execute format('create policy %I on %I for insert with check (current_user_role() = any (array[''admin''::user_role, ''cxo''::user_role]))', t || '_insert', t);
    execute format('create policy %I on %I for update using (current_user_role() = any (array[''admin''::user_role, ''cxo''::user_role]))', t || '_update', t);
    execute format('create policy %I on %I for delete using (current_user_role() = any (array[''admin''::user_role, ''cxo''::user_role]))', t || '_delete', t);
  end loop;
end $$;
