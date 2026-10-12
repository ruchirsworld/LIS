-- Purchase side and tax-invoice fields.
--
--  * Vendors: separate GSTIN and PAN (backfilled from the old combined field).
--  * Vendor bills: TDS deducted (section + rate), the supplier's own invoice
--    number and date. Posting books input GST split by place of supply
--    (Input CGST / SGST / IGST) and the TDS as a liability (TDS Payable) so the
--    vendor is owed the bill less TDS.
--  * Invoices: HSN/SAC and description of supply, for the tax invoice.
--  * Company: bank details printed on the invoice.

-- ── Invoices / company ────────────────────────────────────────────────────
alter table invoices add column if not exists hsn_sac text;
alter table invoices add column if not exists description text;
alter table company_profile add column if not exists bank_details text;

-- ── Vendors ───────────────────────────────────────────────────────────────
alter table vendors add column if not exists gstin text;
alter table vendors add column if not exists pan text;

update vendors set
  gstin = coalesce(gstin, (regexp_match(upper(replace(gstpan, ' ', '')), '(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])'))[1]),
  pan = coalesce(pan, (regexp_match(upper(replace(gstpan, ' ', '')), '([A-Z]{5}\d{4}[A-Z])'))[1])
where gstpan is not null and (gstin is null or pan is null);
update vendors set pan = substr(gstin, 3, 10) where pan is null and gstin is not null;

-- ── Vendor bills ──────────────────────────────────────────────────────────
alter table vendor_bills add column if not exists tds_pct numeric not null default 0 check (tds_pct >= 0 and tds_pct <= 100);
alter table vendor_bills add column if not exists tds_section text;
alter table vendor_bills add column if not exists vendor_invoice_no text;
alter table vendor_bills add column if not exists vendor_invoice_date date;

drop trigger if exists trg_round_amount on vendor_bills;
create trigger trg_round_amount before insert or update on vendor_bills for each row execute function round_amount_2dp();
drop trigger if exists trg_round_amount on vendor_bill_payments;
create trigger trg_round_amount before insert or update on vendor_bill_payments for each row execute function round_amount_2dp();

insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select v.code, v.name, v.account_type, v.normal_balance, coalesce((select sort_order from gl_accounts where code = v.near), 0)
from (values
  ('1051', 'Input CGST Recoverable', 'asset',     'debit',  '1050'),
  ('1052', 'Input SGST Recoverable', 'asset',     'debit',  '1050'),
  ('1053', 'Input IGST Recoverable', 'asset',     'debit',  '1050'),
  ('2070', 'TDS Payable',            'liability', 'credit', '2030')
) as v(code, name, account_type, normal_balance, near)
where not exists (select 1 from gl_accounts g where g.code = v.code);

create or replace function vendor_state_code(p_vendor uuid) returns text
language sql stable set search_path to 'public' as $$
  select case when upper(trim(gstin)) ~ '^[0-9]{2}' then substr(upper(trim(gstin)), 1, 2) end
  from vendors where id = p_vendor
$$;

-- Bill posting: expense at its taxable value, input GST split by place of
-- supply, the vendor credited the bill less TDS, and the TDS held as a liability.
create or replace function post_vendor_bill() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_entry_id uuid;
  v_taxable numeric;
  v_gst numeric;
  v_tds numeric;
  v_company text;
  v_vendor text;
  v_cgst numeric;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'vendor_bills' and source_id = new.id);

  if new.sub_head_id is null or new.date is null then
    delete from journal_entries where source_table = 'vendor_bills' and source_id = new.id;
    return new;
  end if;

  v_taxable := new.amount + coalesce(new.other_cost, 0);
  v_gst := round(new.amount * new.gst_pct / 100, 2);
  v_tds := round(v_taxable * coalesce(new.tds_pct, 0) / 100, 2);

  insert into journal_entries (date, description, source_table, source_id)
  values (new.date, 'Vendor bill — ' || coalesce(new.display_id, new.description, ''), 'vendor_bills', new.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, sub_head_id)
  values (v_entry_id, expense_gl_account(new.sub_head_id), v_taxable, 0, new.project_id, new.sub_head_id);

  if v_gst > 0 then
    v_company := company_state_code();
    v_vendor := vendor_state_code(new.vendor_id);
    if v_company is not null and v_vendor is not null then
      if v_company = v_vendor then
        v_cgst := round(v_gst / 2, 2);
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry_id, gl_acct('1051'), v_cgst, 0);
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry_id, gl_acct('1052'), v_gst - v_cgst, 0);
      else
        insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry_id, gl_acct('1053'), v_gst, 0);
      end if;
    else
      -- Supplier GSTIN or your own is missing: kept in the general input-GST account.
      insert into journal_lines (entry_id, gl_account_id, debit, credit) values (v_entry_id, gl_acct('1050'), v_gst, 0);
    end if;
  end if;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, vendor_id, project_id)
  values (v_entry_id, gl_acct('2010'), 0, v_taxable + v_gst - v_tds, new.vendor_id, new.project_id);
  if v_tds > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, vendor_id, project_id)
    values (v_entry_id, gl_acct('2070'), 0, v_tds, new.vendor_id, new.project_id);
  end if;
  return new;
end;
$$;

-- total = what the bill costs (taxable + other charges + GST); payable = what the
-- vendor is actually owed (total less TDS withheld). The old total left out
-- other charges although they were posted, so vendor dues disagreed with the ledger.
create or replace view v_vendor_bill_computed as
select
  id, display_id, vendor_id, description, client_id, project_id, date, amount, gst_pct, created_by, created_at,
  round(amount * gst_pct / 100::numeric, 2) as gst_amt,
  (amount + coalesce(other_cost, 0) + round(amount * gst_pct / 100::numeric, 2)) as total,
  coalesce((select sum(p.amount) from vendor_bill_payments p where p.bill_id = b.id), 0::numeric) as paid,
  coalesce(other_cost, 0) as other_cost,
  tds_pct,
  round((amount + coalesce(other_cost, 0)) * tds_pct / 100::numeric, 2) as tds_amt,
  (amount + coalesce(other_cost, 0) + round(amount * gst_pct / 100::numeric, 2)
     - round((amount + coalesce(other_cost, 0)) * tds_pct / 100::numeric, 2)) as payable
from vendor_bills b;
alter view v_vendor_bill_computed set (security_invoker = true);

-- Vendors are owed the payable, not the gross.
create or replace view v_vendor_summary as
select ve.id as vendor_id, ve.name,
       sum(vb.total) as total_purchases,
       sum(vb.paid) as total_paid,
       sum(vb.payable - vb.paid) as due
from vendors ve join v_vendor_bill_computed vb on vb.vendor_id = ve.id
group by ve.id, ve.name;
alter view v_vendor_summary set (security_invoker = true);

create or replace view v_dashboard_kpis as
select
  (select coalesce(sum(greatest(net_payable - retention_amount - (total_paid - released_paid), 0::numeric)), 0::numeric)
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
  (select coalesce(sum(due_amount), 0::numeric) from v_invoice_status where effective_status = 'overdue') as overdue_invoices_amount;
alter view v_dashboard_kpis set (security_invoker = true);
