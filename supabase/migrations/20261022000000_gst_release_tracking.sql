-- GST released by the client only after proof of deposit.
--
-- Some clients pay the taxable value (less TDS) first, and release the GST only
-- once the supplier has deposited it with the government (GSTR-3B) and sent the
-- client proof. Until then that GST is owed, but not collectible — like retention,
-- it must not count as Due or make the invoice overdue.
--
--  * clients.gst_on_proof: this client works that way (new invoices default to it).
--  * invoices.gst_on_hold: GST on this invoice is held until released; plus the
--    tracker (GSTR-3B period, date filed, date proof sent to the client).
--  * invoice_payments.gst_component: how much of a payment was the GST release.
--    One lump-sum receipt can carry both the taxable part and the GST.
--  * The ledger is unchanged — the client still owes the GST. This is a status
--    and collection layer: Due, overdue and "paid" exclude GST still held.
alter table clients add column if not exists gst_on_proof boolean not null default false;

alter table invoices add column if not exists gst_on_hold boolean not null default false;
alter table invoices add column if not exists gstr3b_period text;
alter table invoices add column if not exists gstr3b_filed_on date;
alter table invoices add column if not exists gstr3b_sent_on date;

alter table invoice_payments add column if not exists gst_component numeric not null default 0 check (gst_component >= 0);

create or replace function round_payment_amounts() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.amount := round(new.amount, 2);
  new.gst_component := round(coalesce(new.gst_component, 0), 2);
  if new.gst_component > new.amount then
    raise exception 'The GST part of a payment (%) cannot be more than the payment itself (%).', new.gst_component, new.amount;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_round_amount on invoice_payments;
create trigger trg_round_amount before insert or update on invoice_payments for each row execute function round_payment_amounts();

create or replace view v_invoice_computed as
with b as (
  select
    i.id, i.display_id, i.client_id, i.project_id, i.amount, i.gst_pct, i.tds_pct, i.due_date_manual, i.due_days,
    i.invoice_date, i.status, i.created_by, i.created_at,
    (round(i.amount * i.gst_pct / 100::numeric, 2) + coalesce(n.gst, 0)) as gst_amt,
    (round(i.amount * i.tds_pct / 100::numeric, 2) + coalesce(n.tds, 0)) as tds_amt,
    (i.amount + round(i.amount * i.gst_pct / 100::numeric, 2) - round(i.amount * i.tds_pct / 100::numeric, 2) + coalesce(n.net, 0)) as net_payable,
    coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0::numeric) as total_paid,
    case when i.due_days is not null and i.invoice_date is not null then i.invoice_date + i.due_days else i.due_date_manual end as effective_due_date,
    i.retention_pct,
    (round((i.amount + round(i.amount * i.gst_pct / 100::numeric, 2) - round(i.amount * i.tds_pct / 100::numeric, 2)) * i.retention_pct / 100::numeric, 2) + coalesce(n.ret, 0)) as retention_amount,
    coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id and p.is_retention_release), 0::numeric) as released_paid,
    coalesce(n.amt, 0) as note_amount,
    i.gst_on_hold,
    coalesce((select sum(p.gst_component) from invoice_payments p where p.invoice_id = i.id and not p.is_retention_release), 0::numeric) as gst_released
  from invoices i
  left join (
    select invoice_id,
           sum(case when note_type = 'credit' then -amount else amount end) as amt,
           sum(case when note_type = 'credit' then -gst_amount else gst_amount end) as gst,
           sum(case when note_type = 'credit' then -tds_amount else tds_amount end) as tds,
           sum(case when note_type = 'credit' then -net_amount else net_amount end) as net,
           sum(case when note_type = 'credit' then -retention_amount else retention_amount end) as ret
    from invoice_notes group by invoice_id
  ) n on n.invoice_id = i.id
)
select b.*,
       case when b.gst_on_hold then greatest(b.gst_amt - b.gst_released, 0::numeric) else 0::numeric end as gst_held
from b;
alter view v_invoice_computed set (security_invoker = true);

-- Due, overdue and "paid" leave out GST still held back.
create or replace view v_invoice_status as
select
  id, display_id, client_id, project_id, amount, gst_pct, tds_pct, due_date_manual, due_days, invoice_date, status, created_by, created_at,
  gst_amt, tds_amt, net_payable, total_paid, effective_due_date,
  greatest(net_payable - retention_amount - (total_paid - released_paid) - gst_held, 0::numeric) as due_amount,
  case
    when net_payable > 0::numeric
         and (net_payable - retention_amount - (total_paid - released_paid) - gst_held) <= 0.01
         and (retention_amount - released_paid) <= 0.01
         and gst_held <= 0.01 then 'paid'::text
    when effective_due_date is not null
         and current_date > effective_due_date
         and (net_payable - retention_amount - (total_paid - released_paid) - gst_held) > 0.01 then 'overdue'::text
    else status::text
  end as effective_status,
  retention_pct,
  retention_amount
from v_invoice_computed v;
alter view v_invoice_status set (security_invoker = true);

create or replace view v_dashboard_kpis as
select
  (select coalesce(sum(greatest(net_payable - retention_amount - (total_paid - released_paid) - gst_held, 0::numeric)), 0::numeric)
     from v_invoice_computed) as outstanding_from_clients,
  (select coalesce(sum(amount), 0::numeric) from expenses
     where date_trunc('month', date::timestamp) = date_trunc('month', current_date::timestamp)
       and status = 'approved') as expenses_this_month,
  (select count(*) from projects where status = 'active'::project_status) as active_projects,
  (select count(*) from clients) as clients_count,
  (select coalesce(sum(payable - paid), 0::numeric) from v_vendor_bill_computed) as owed_to_vendors,
  (select coalesce(sum(outstanding), 0::numeric) from v_loan_computed) as loan_principal_outstanding,
  (select coalesce(sum(case when type = 'injection'::capital_tx_type then amount else -amount end), 0::numeric)
     from capital_transactions) as net_partner_capital,
  (select coalesce(sum(jl.debit - jl.credit), 0::numeric)
     from journal_lines jl join gl_accounts ga on ga.id = jl.gl_account_id
     where ga.code = any (array['1010', '1020'])) as cash_and_bank_balance,
  (select count(*) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_count,
  (select coalesce(sum(due_amount), 0::numeric) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_amount,
  (select coalesce(sum(gst_held), 0::numeric) from v_invoice_computed) as gst_held_by_clients;
alter view v_dashboard_kpis set (security_invoker = true);
