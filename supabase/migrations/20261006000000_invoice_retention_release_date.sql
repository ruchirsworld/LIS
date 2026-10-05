-- The date a client's retention (the held-back % of an invoice) is due to be
-- released, set when the invoice is raised. Optional; invoices without
-- retention leave it empty.
alter table invoices add column if not exists retention_release_date date;
