-- Both VendorPaymentForm and VendorBillPaymentForm let the user pick a
-- specific bank account (not just "Cash" vs "UPI/NEFT") and infer
-- payment_mode as 'Bank' whenever a real bank account is chosen — but the
-- check constraint only allowed 'UPI'/'NEFT'/'Cash', so every payment made
-- via any bank account (not Cash) has been failing with "Could not record
-- payment." payment_mode isn't used by the GL posting trigger at all
-- (post_vendor_bill_payment branches on bank_account_id, not payment_mode)
-- so widening this is purely cosmetic/reference and safe.
alter table vendor_bill_payments
  drop constraint vendor_bill_payments_payment_mode_check;
alter table vendor_bill_payments
  add constraint vendor_bill_payments_payment_mode_check
  check (payment_mode = any (array['UPI', 'NEFT', 'Cash', 'Bank']));
