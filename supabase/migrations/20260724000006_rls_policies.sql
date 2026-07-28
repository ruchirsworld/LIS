-- RLS: two tiers only (Admin vs. everyone-else), per the CXO = Staff clarification.
--
--  Tier A (admin write / everyone read):  clients, projects, cost_centers,
--    partners, employees
--  Tier A-variant (open insert, admin update/delete): expense_types
--  Tier A (admin only, all ops):           employee_sensitive
--  Tier B (fully open to any authenticated user): vendors, invoices,
--    invoice_payments, vendor_bills, vendor_bill_payments, expenses, loans,
--    loan_payments, capital_transactions, attendance, team_tracker
--
-- profiles gets its own shape: everyone can read (needed to show "created by"
-- names and for role-based UI), only admin can write.

-- profiles
create policy "profiles_select" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert" on profiles for insert with check (is_admin());
create policy "profiles_update" on profiles for update using (is_admin());
create policy "profiles_delete" on profiles for delete using (is_admin());

-- Tier A: admin write, everyone read
do $$
declare t text;
begin
  foreach t in array array['clients','projects','cost_centers','partners','employees'] loop
    execute format('create policy "%1$s_select" on %1$s for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "%1$s_insert" on %1$s for insert with check (is_admin())', t);
    execute format('create policy "%1$s_update" on %1$s for update using (is_admin())', t);
    execute format('create policy "%1$s_delete" on %1$s for delete using (is_admin())', t);
  end loop;
end $$;

-- Tier A-variant: expense_types — insert open to any authenticated user
-- (mirrors the prototype's inline "+ Add new category" on the expense form),
-- rename/delete admin-only (mirrors the Admin-tab management form).
create policy "expense_types_select" on expense_types for select using (auth.role() = 'authenticated');
create policy "expense_types_insert" on expense_types for insert with check (auth.role() = 'authenticated');
create policy "expense_types_update" on expense_types for update using (is_admin());
create policy "expense_types_delete" on expense_types for delete using (is_admin());

-- employee_sensitive: admin only, full stop
create policy "employee_sensitive_all" on employee_sensitive for all
  using (is_admin()) with check (is_admin());

-- Tier B: fully open to any authenticated user
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','invoices','invoice_payments','vendor_bills','vendor_bill_payments',
    'expenses','loans','loan_payments','capital_transactions','attendance','team_tracker'
  ] loop
    execute format(
      'create policy "%1$s_all" on %1$s for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;
