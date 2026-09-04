-- Retention money: a client contractually withholds a % of an invoice's
-- value for a period (common in construction) — it's not overdue/collectible
-- until released, so it must not count toward "due now" or "overdue" figures,
-- but it also doesn't reduce GST liability (GST is charged on the full
-- invoice value regardless of when the retained portion is actually paid).
alter table invoices add column retention_pct numeric not null default 0
  check (retention_pct >= 0 and retention_pct <= 100);

-- CREATE OR REPLACE VIEW can only append columns, not reorder/insert them —
-- retention_pct/retention_amount go at the end of each view's column list.
create or replace view v_invoice_computed as
select
  id, display_id, client_id, project_id, amount, gst_pct, tds_pct,
  due_date_manual, due_days, invoice_date, status, created_by, created_at,
  amount * gst_pct / 100 as gst_amt,
  amount * tds_pct / 100 as tds_amt,
  amount + amount * gst_pct / 100 - amount * tds_pct / 100 as net_payable,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0) as total_paid,
  case when due_days is not null and invoice_date is not null then invoice_date + due_days else due_date_manual end as effective_due_date,
  retention_pct,
  (amount + amount * gst_pct / 100 - amount * tds_pct / 100) * retention_pct / 100 as retention_amount
from invoices i;

create or replace view v_invoice_status as
select
  id, display_id, client_id, project_id, amount, gst_pct, tds_pct,
  due_date_manual, due_days, invoice_date, status, created_by, created_at,
  gst_amt, tds_amt, net_payable, total_paid, effective_due_date,
  greatest(net_payable - retention_amount - total_paid, 0) as due_amount,
  case
    when (net_payable - total_paid) <= 0.01 and net_payable > 0 then 'paid'
    when effective_due_date is not null and current_date > effective_due_date
         and (net_payable - retention_amount - total_paid) > 0.01 then 'overdue'
    else status::text
  end as effective_status,
  retention_pct,
  retention_amount
from v_invoice_computed v;

-- Outstanding-from-clients should reflect what's actually collectible now,
-- not money contractually held back as retention.
create or replace view v_dashboard_kpis as
select
  (select coalesce(sum(greatest(net_payable - retention_amount - total_paid, 0)), 0) from v_invoice_computed) as outstanding_from_clients,
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
