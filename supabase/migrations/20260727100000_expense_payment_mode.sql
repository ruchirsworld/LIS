-- Mode of payment (UPI/Cash/Bank) for the universal "Add transaction" form
-- (Expenses tab), across every category it writes to. Mirrors the
-- vendor_bill_payments.payment_mode pattern, but with "Bank" in place of
-- "NEFT" per this feature's own spec.
alter table expenses
  add column payment_mode text check (payment_mode in ('UPI', 'Cash', 'Bank'));

alter table loan_payments
  add column payment_mode text check (payment_mode in ('UPI', 'Cash', 'Bank'));

alter table capital_transactions
  add column payment_mode text check (payment_mode in ('UPI', 'Cash', 'Bank'));
