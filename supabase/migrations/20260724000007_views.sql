-- Cross-row aggregate views for Dashboard KPIs and the Consolidated-by-X tabs.
-- Per-row computed fields (net_payable, due_amount, effective_status, etc.)
-- also live here as views so both the app and these aggregates share one
-- source of truth, but the app is free to compute the same per-row values
-- client-side too (see src/lib/calc) when it already has the raw rows loaded.
--
-- security_invoker ensures these views enforce RLS as the querying user,
-- not the view owner.

create view v_invoice_computed
with (security_invoker = true) as
select
  i.*,
  (i.amount * i.gst_pct / 100) as gst_amt,
  (i.amount * i.tds_pct / 100) as tds_amt,
  (i.amount + i.amount * i.gst_pct / 100 - i.amount * i.tds_pct / 100) as net_payable,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0) as total_paid,
  case
    when i.due_days is not null and i.invoice_date is not null then i.invoice_date + i.due_days
    else i.due_date_manual
  end as effective_due_date
from invoices i;

create view v_invoice_status
with (security_invoker = true) as
select
  v.*,
  greatest(v.net_payable - v.total_paid, 0) as due_amount,
  case
    when (v.net_payable - v.total_paid) <= 0.01 and v.net_payable > 0 then 'paid'
    when v.effective_due_date is not null and current_date > v.effective_due_date then 'overdue'
    else v.status::text
  end as effective_status
from v_invoice_computed v;

create view v_client_summary
with (security_invoker = true) as
select
  c.id as client_id,
  c.name,
  sum(v.net_payable) as total_invoiced,
  sum(v.total_paid) as received,
  sum(v.net_payable - v.total_paid) as due
from clients c
join v_invoice_computed v on v.client_id = c.id
group by c.id, c.name;

create view v_project_summary
with (security_invoker = true) as
select
  p.id as project_id,
  p.name,
  cl.name as client_name,
  sum(v.net_payable) as total_invoiced,
  sum(v.total_paid) as received,
  sum(v.net_payable - v.total_paid) as due
from projects p
join v_invoice_computed v on v.project_id = p.id
left join clients cl on cl.id = p.client_id
group by p.id, p.name, cl.name;

create view v_vendor_bill_computed
with (security_invoker = true) as
select
  b.*,
  (b.amount * b.gst_pct / 100) as gst_amt,
  (b.amount + b.amount * b.gst_pct / 100) as total,
  coalesce((select sum(p.amount) from vendor_bill_payments p where p.bill_id = b.id), 0) as paid
from vendor_bills b;

create view v_vendor_summary
with (security_invoker = true) as
select
  ve.id as vendor_id,
  ve.name,
  sum(vb.total) as total_purchases,
  sum(vb.paid) as total_paid,
  sum(vb.total - vb.paid) as due
from vendors ve
join v_vendor_bill_computed vb on vb.vendor_id = ve.id
group by ve.id, ve.name;

create view v_loan_computed
with (security_invoker = true) as
select
  l.*,
  coalesce((select sum(p.principal_paid) from loan_payments p where p.loan_id = l.id), 0) as principal_paid,
  coalesce((select sum(p.interest_paid) from loan_payments p where p.loan_id = l.id), 0) as interest_paid,
  greatest(
    l.principal - coalesce((select sum(p.principal_paid) from loan_payments p where p.loan_id = l.id), 0),
    0
  ) as outstanding
from loans l;

create view v_capital_summary
with (security_invoker = true) as
select
  pt.id as partner_id,
  pt.name,
  coalesce(sum(ct.amount) filter (where ct.type = 'injection'), 0) as total_injected,
  coalesce(sum(ct.amount) filter (where ct.type = 'withdrawal'), 0) as total_withdrawn,
  coalesce(sum(ct.amount) filter (where ct.type = 'injection'), 0)
    - coalesce(sum(ct.amount) filter (where ct.type = 'withdrawal'), 0) as net
from partners pt
left join capital_transactions ct on ct.partner_id = pt.id
group by pt.id, pt.name;

create view v_dashboard_kpis
with (security_invoker = true) as
select
  (select coalesce(sum(net_payable - total_paid), 0) from v_invoice_computed) as outstanding_from_clients,
  (select coalesce(sum(amount), 0) from expenses
     where date_trunc('month', date) = date_trunc('month', current_date)) as expenses_this_month,
  (select count(*) from projects where status = 'active') as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(total - paid), 0) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection' then amount else -amount end), 0)
     from capital_transactions) as net_partner_capital,
  (select count(*) from employees) as team_members_count;
