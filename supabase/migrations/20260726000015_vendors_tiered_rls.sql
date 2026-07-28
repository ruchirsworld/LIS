-- Vendors move out of the "fully open to any authenticated user" tier:
-- everyone can still read (needed for dropdowns on Expenses/Vendor bills),
-- Admin and CXO can add new vendors, but only Admin can edit or remove one.
drop policy "vendors_all" on vendors;

create policy "vendors_select" on vendors for select
  using (auth.role() = 'authenticated');
create policy "vendors_insert" on vendors for insert
  with check (current_user_role() in ('admin', 'cxo'));
create policy "vendors_update" on vendors for update
  using (is_admin());
create policy "vendors_delete" on vendors for delete
  using (is_admin());
