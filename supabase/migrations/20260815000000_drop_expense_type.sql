-- expenses.type has been hardcoded to 'General' on every insert for a long
-- while (the old Purchase/Project/Loan/Capital masterhead toggle is gone —
-- vendor spend moved to Procurements, Loan/Capital have their own tabs), so
-- every "by type" grouping anywhere in the app was always just one row
-- ("General") duplicating a total shown elsewhere. Dropping the column and
-- the report function's now-pointless expenses_by_type breakdown with it.

create or replace function report_summary(p_from date default null, p_to date default null)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'output_gst', coalesce((
      select sum(amount * gst_pct / 100) from invoices
      where (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0),
    'input_gst', coalesce((
      select sum(amount * gst_pct / 100) from vendor_bills
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'tds_deducted', coalesce((
      select sum(amount * tds_pct / 100) from invoices
      where (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0),
    'total_invoiced', coalesce((
      select sum(amount + amount * gst_pct / 100 - amount * tds_pct / 100) from invoices
      where (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0),
    'total_received', coalesce((
      select sum(amount) from invoice_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'total_expenses', coalesce((
      select sum(amount) from expenses
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'vendor_purchases', coalesce((
      select sum(amount + amount * gst_pct / 100) from vendor_bills
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'vendor_paid', coalesce((
      select sum(amount) from vendor_bill_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_interest_paid', coalesce((
      select sum(interest_paid) from loan_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_principal_paid', coalesce((
      select sum(principal_paid) from loan_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'loan_outstanding_total', coalesce((select sum(outstanding) from v_loan_computed), 0),
    'capital_injected', coalesce((
      select sum(amount) from capital_transactions
      where type = 'injection' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'capital_withdrawn', coalesce((
      select sum(amount) from capital_transactions
      where type = 'withdrawal' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0)
  );
$$;

alter table expenses drop column type;
