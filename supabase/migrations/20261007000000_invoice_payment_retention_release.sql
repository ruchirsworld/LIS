-- Retention is only "released" when a payment is recorded as a retention
-- release. Before, any payment beyond (net payable - retention) was treated
-- as an implied release, so an invoice paid more than its collectible part
-- (a lump-sum receipt that ran ahead, say) wrongly showed retention as
-- released. Existing payments all default to ordinary (false).
alter table invoice_payments add column if not exists is_retention_release boolean not null default false;

-- released_paid is appended at the end so the existing columns keep their positions.
create or replace view v_invoice_computed as
select
  id,
  display_id,
  client_id,
  project_id,
  amount,
  gst_pct,
  tds_pct,
  due_date_manual,
  due_days,
  invoice_date,
  status,
  created_by,
  created_at,
  (amount * gst_pct / 100::numeric) as gst_amt,
  (amount * tds_pct / 100::numeric) as tds_amt,
  (amount + amount * gst_pct / 100::numeric - amount * tds_pct / 100::numeric) as net_payable,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0::numeric) as total_paid,
  case
    when due_days is not null and invoice_date is not null then invoice_date + due_days
    else due_date_manual
  end as effective_due_date,
  retention_pct,
  ((amount + amount * gst_pct / 100::numeric - amount * tds_pct / 100::numeric) * retention_pct / 100::numeric) as retention_amount,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id and p.is_retention_release), 0::numeric) as released_paid
from invoices i;

-- Due = collectible part only: ordinary payments against (net - retention).
-- "paid" needs the collectible part cleared AND the retention released.
create or replace view v_invoice_status as
select
  id,
  display_id,
  client_id,
  project_id,
  amount,
  gst_pct,
  tds_pct,
  due_date_manual,
  due_days,
  invoice_date,
  status,
  created_by,
  created_at,
  gst_amt,
  tds_amt,
  net_payable,
  total_paid,
  effective_due_date,
  greatest(net_payable - retention_amount - (total_paid - released_paid), 0::numeric) as due_amount,
  case
    when net_payable > 0::numeric
         and (net_payable - retention_amount - (total_paid - released_paid)) <= 0.01
         and (retention_amount - released_paid) <= 0.01 then 'paid'::text
    when effective_due_date is not null
         and current_date > effective_due_date
         and (net_payable - retention_amount - (total_paid - released_paid)) > 0.01 then 'overdue'::text
    else status::text
  end as effective_status,
  retention_pct,
  retention_amount
from v_invoice_computed v;

create or replace view v_dashboard_kpis as
select
  (select coalesce(sum(greatest(net_payable - retention_amount - (total_paid - released_paid), 0::numeric)), 0::numeric)
     from v_invoice_computed) as outstanding_from_clients,
  (select coalesce(sum(amount), 0::numeric) from expenses
     where date_trunc('month', date::timestamp) = date_trunc('month', current_date::timestamp)
       and status = 'approved') as expenses_this_month,
  (select count(*) from projects where status = 'active'::project_status) as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(total - paid), 0::numeric) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0::numeric) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection'::capital_tx_type then amount else -amount end), 0::numeric)
     from capital_transactions) as net_partner_capital,
  (select coalesce(sum(jl.debit - jl.credit), 0::numeric)
     from journal_lines jl join gl_accounts ga on ga.id = jl.gl_account_id
     where ga.code = any (array['1010', '1020'])) as cash_and_bank_balance,
  (select count(*) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_count,
  (select coalesce(sum(due_amount), 0::numeric) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_amount;

alter view v_invoice_computed set (security_invoker = true);
alter view v_invoice_status set (security_invoker = true);
alter view v_dashboard_kpis set (security_invoker = true);
