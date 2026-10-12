-- The summary figures counted things that are not in the books yet:
--   * Draft invoices (when no period is chosen, and in the dashboard "outstanding" and GST-held cards)
--   * Pending and rejected expense claims in "total expenses"
-- They now count only Sent invoices and approved expenses, the same as the Profit and Loss
-- and the GST workings. Credit and debit notes are included, so GST and TDS agree with the GST workings.

create or replace function report_summary(p_from date default null, p_to date default null)
returns json
language sql stable set search_path to 'public' as $$
  select json_build_object(
    'output_gst', coalesce((
      select sum(amount * gst_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.gst_amount else n.gst_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'input_gst', coalesce((
      select sum(amount * gst_pct / 100) from vendor_bills
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'tds_deducted', coalesce((
      select sum(amount * tds_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.tds_amount else n.tds_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'total_invoiced', coalesce((
      select sum(amount + amount * gst_pct / 100 - amount * tds_pct / 100) from invoices
      where status = 'sent' and (p_from is null or invoice_date >= p_from) and (p_to is null or invoice_date <= p_to)
    ), 0) + coalesce((
      select sum(case when n.note_type = 'credit' then -n.net_amount else n.net_amount end)
      from invoice_notes n join invoices i on i.id = n.invoice_id
      where i.status = 'sent' and (p_from is null or n.date >= p_from) and (p_to is null or n.date <= p_to)
    ), 0),
    'total_received', coalesce((
      select sum(amount) from invoice_payments
      where (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
    ), 0),
    'total_expenses', coalesce((
      select sum(amount) from expenses
      where status = 'approved' and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
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

create or replace view v_dashboard_kpis with (security_invoker = true) as
select
  (select coalesce(sum(greatest(net_payable - retention_amount - (total_paid - released_paid) - gst_held, 0)), 0)
     from v_invoice_computed where status = 'sent') as outstanding_from_clients,
  (select coalesce(sum(amount), 0) from expenses
     where date_trunc('month', date::timestamp) = date_trunc('month', current_date::timestamp) and status = 'approved') as expenses_this_month,
  (select count(*) from projects where status = 'active') as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(payable - paid), 0) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection' then amount else -amount end), 0) from capital_transactions) as net_partner_capital,
  (select coalesce(sum(jl.debit - jl.credit), 0) from journal_lines jl join gl_accounts ga on ga.id = jl.gl_account_id
     where ga.code in ('1010', '1020')) as cash_and_bank_balance,
  (select count(*) from v_invoice_status where effective_status = 'overdue' and status = 'sent') as overdue_invoices_count,
  (select coalesce(sum(due_amount), 0) from v_invoice_status where effective_status = 'overdue' and status = 'sent') as overdue_invoices_amount,
  (select coalesce(sum(gst_held), 0) from v_invoice_computed where status = 'sent') as gst_held_by_clients;
