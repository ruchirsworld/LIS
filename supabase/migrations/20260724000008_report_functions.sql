-- Reports tab supports an arbitrary custom date range, so these are
-- parameterized RPC functions rather than views. Passing null for p_from
-- and/or p_to means "no lower/upper bound" (i.e. "All time" when both are null).

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
    'expenses_by_type', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select type, sum(amount) as amount from expenses
        where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
        group by type order by sum(amount) desc
      ) t
    ),
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
