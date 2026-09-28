-- These three views ran with their owner's rights, so they bypassed the row
-- level security on the tables underneath and answered to the public anon key
-- (dashboard cash/receivables and every invoice row were readable with no
-- login). Every other view here already sets security_invoker; this brings
-- these three in line so they only return what the signed-in caller could
-- read from the tables directly.
alter view v_dashboard_kpis set (security_invoker = true);
alter view v_invoice_computed set (security_invoker = true);
alter view v_invoice_status set (security_invoker = true);
