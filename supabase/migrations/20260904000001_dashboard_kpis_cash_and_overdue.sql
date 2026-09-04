-- Adds cash+bank position and overdue-invoices figures to the dashboard KPI
-- view, for the redesigned Admin dashboard's "Position today" and "Needs
-- attention" groups. Everything else in the view is unchanged.
create or replace view v_dashboard_kpis as
select
  (select coalesce(sum(net_payable - total_paid), 0) from v_invoice_computed) as outstanding_from_clients,
  (select coalesce(sum(amount), 0) from expenses
     where date_trunc('month', date::timestamp) = date_trunc('month', current_date::timestamp)
       and status = 'approved') as expenses_this_month,
  (select count(*) from projects where status = 'active') as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(total - paid), 0) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection' then amount else -amount end), 0) from capital_transactions) as net_partner_capital,
  (select coalesce(sum(jl.debit - jl.credit), 0)
     from journal_lines jl join gl_accounts ga on ga.id = jl.gl_account_id
     where ga.code in ('1010', '1020')) as cash_and_bank_balance,
  (select count(*) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_count,
  (select coalesce(sum(due_amount), 0) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_amount;
