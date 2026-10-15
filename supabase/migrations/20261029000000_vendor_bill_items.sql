-- The items bought on a vendor bill (what the bill value is made of).
-- Informational only: GST and TDS stay on the bill, and the bill still posts as one cost.
-- When a bill has items, its amount is their total (the app keeps the two in step).
create table if not exists vendor_bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references vendor_bills(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  qty numeric,
  unit text,
  rate numeric,
  amount numeric not null,
  created_at timestamptz not null default now(),
  constraint vendor_bill_items_amount_nonneg check (amount >= 0)
);
create index if not exists vendor_bill_items_bill_id_idx on vendor_bill_items (bill_id);

alter table vendor_bill_items enable row level security;
create policy vendor_bill_items_select on vendor_bill_items for select using (is_back_office());
create policy vendor_bill_items_insert on vendor_bill_items for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy vendor_bill_items_update on vendor_bill_items for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy vendor_bill_items_delete on vendor_bill_items for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

create trigger trg_round_amount before insert or update on vendor_bill_items for each row execute function round_amount_2dp();
create trigger trg_audit_update after update on vendor_bill_items for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on vendor_bill_items for each row execute function audit_row_change();
