-- Mode of payment (UPI / NEFT / Cash) for the "Record payments" quick-add
-- form on Purchases. Nullable so existing rows (recorded before this field
-- existed) remain valid.
alter table vendor_bill_payments
  add column payment_mode text check (payment_mode in ('UPI', 'NEFT', 'Cash'));
