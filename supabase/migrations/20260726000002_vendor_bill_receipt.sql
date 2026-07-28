-- Lets a bill photo be attached to a vendor bill, same private 'receipts'
-- bucket as Expenses (existing policies are bucket-wide, not path-scoped).
alter table vendor_bills add column receipt_path text;
