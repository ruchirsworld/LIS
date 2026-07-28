-- Manual external/customer-facing invoice number, distinct from the
-- internal auto-generated display_id (Inv/MMYY/NN).
alter table invoices add column invoice_number text;
