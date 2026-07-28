-- Private bucket for expense receipt photos (replaces the prototype's inline
-- base64 image stored directly on the expense row).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_authenticated" on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "receipts_insert_authenticated" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "receipts_delete_authenticated" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');
