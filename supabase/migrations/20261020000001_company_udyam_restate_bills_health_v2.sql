-- Udyam registration number on the company profile (printed on ledgers and
-- invoices); vendor bills re-posted under the purchase posting rules in
-- 20261020000000; books_health_check() gains the purchase-side and tax-invoice
-- checks (vendor bill vs ledger, input GST without a supplier GSTIN, TDS
-- without a PAN, TDS not paid by the 7th, invoices without an HSN/SAC code).
alter table company_profile add column if not exists udyam_no text;
update company_profile set udyam_no = 'UDYAM-DL-02-0021526' where udyam_no is null;

update vendor_bills set amount = amount;

create or replace function books_health_check()
returns table (check_code text, severity text, title text, detail text, amount numeric)
language sql stable set search_path to 'public' as $$
  select 'UNBALANCED', 'error', 'Journal entry does not balance',
         coalesce(e.display_id, e.id::text) || ' — ' || coalesce(e.description, ''), abs(sum(l.debit) - sum(l.credit))
  from journal_entries e join journal_lines l on l.entry_id = e.id
  group by e.id, e.display_id, e.description
  having abs(sum(l.debit) - sum(l.credit)) > 0.005

  union all
  select 'INV_NOT_POSTED', 'error', 'Sent invoice is not in the ledger', coalesce(i.invoice_number, i.display_id), i.amount
  from invoices i
  where i.status = 'sent' and i.invoice_date is not null
    and not exists (select 1 from journal_entries e where e.source_table = 'invoices' and e.source_id = i.id)

  union all
  select 'INV_VS_GL', 'error', 'Invoice differs from its ledger posting',
         coalesce(i.invoice_number, i.display_id) || ': invoice ' ||
           to_char(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2), 'FM9999999990.00') ||
           ', ledger ' || to_char(g.dr, 'FM9999999990.00'),
         abs(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2) - g.dr)
  from invoices i
  join lateral (
    select coalesce(sum(l.debit), 0) as dr
    from journal_entries e join journal_lines l on l.entry_id = e.id join gl_accounts a on a.id = l.gl_account_id
    where e.source_table = 'invoices' and e.source_id = i.id and a.code in ('1030', '1035')
  ) g on true
  where i.status = 'sent' and i.invoice_date is not null
    and exists (select 1 from journal_entries e where e.source_table = 'invoices' and e.source_id = i.id)
    and abs(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2) - g.dr) > 0.01

  union all
  select 'BILL_VS_GL', 'error', 'Vendor bill differs from its ledger posting',
         coalesce(b.display_id, '') || ': bill payable ' || to_char(v.payable, 'FM9999999990.00') || ', ledger ' || to_char(g.cr, 'FM9999999990.00'),
         abs(v.payable - g.cr)
  from vendor_bills b
  join v_vendor_bill_computed v on v.id = b.id
  join lateral (
    select coalesce(sum(l.credit), 0) as cr
    from journal_entries e join journal_lines l on l.entry_id = e.id join gl_accounts a on a.id = l.gl_account_id
    where e.source_table = 'vendor_bills' and e.source_id = b.id and a.code = '2010'
  ) g on true
  where b.sub_head_id is not null and abs(v.payable - g.cr) > 0.01

  union all
  select 'BILL_NOT_POSTED', 'warning', 'Vendor bill is not in the ledger (no expense head chosen)', coalesce(b.display_id, ''), b.amount
  from vendor_bills b where b.sub_head_id is null

  union all
  select 'NEGATIVE_CASH', 'error', a.name || ' has a negative balance', 'Cash or bank cannot be below zero — a receipt or opening balance is missing.',
         sum(l.debit - l.credit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id
  where a.code in ('1010', '1020')
  group by a.name
  having sum(l.debit - l.credit) < -0.005

  union all
  select 'DUP_INV_NO', 'error', 'Invoice number used more than once', invoice_number || ' (' || count(*) || ' invoices)', null
  from invoices where invoice_number is not null and trim(invoice_number) <> ''
  group by invoice_number having count(*) > 1

  union all
  select 'INV_NO_LENGTH', 'warning', 'Invoice number longer than 16 characters (GST Rule 46)', invoice_number || ' (' || length(invoice_number) || ' characters)', null
  from invoices where length(invoice_number) > 16

  union all
  select 'INV_NO_HSN', 'warning', 'Sent invoices with no HSN / SAC code', count(*) || ' invoice(s) — add the code so the tax invoice prints in full', sum(i.amount)
  from invoices i where i.status = 'sent' and coalesce(trim(i.hsn_sac), '') = '' having count(*) > 0

  union all
  select 'OVERPAID', 'warning', 'Client has paid more than the invoice',
         coalesce(v.display_id, '') || ' — ' || coalesce(c.name, ''), v.total_paid - v.net_payable
  from v_invoice_computed v left join clients c on c.id = v.client_id
  where v.status = 'sent' and v.total_paid - v.net_payable > 0.01

  union all
  select 'DRAFT_PAID', 'warning', 'Receipt recorded against an invoice that has not been sent',
         coalesce(i.invoice_number, i.display_id), sum(p.amount)
  from invoices i join invoice_payments p on p.invoice_id = i.id
  where i.status = 'draft' group by i.id, i.invoice_number, i.display_id

  union all
  select 'FUTURE_RECEIPT', 'warning', 'Receipt dated in the future', coalesce(p.display_id, '') || ' — ' || to_char(p.date, 'DD Mon YYYY'), p.amount
  from invoice_payments p where p.date > current_date

  union all
  select 'RETENTION_DUE', 'warning', 'Retention release date has passed',
         coalesce(v.display_id, '') || ' — ' || coalesce(c.name, ''), v.retention_amount - v.released_paid
  from v_invoice_computed v join invoices i on i.id = v.id left join clients c on c.id = v.client_id
  where i.retention_release_date < current_date and v.retention_amount - v.released_paid > 0.01

  union all
  select 'GST_UNSPLIT', 'warning', 'GST not split into CGST / SGST / IGST',
         count(distinct e.source_id) || ' invoice(s) posted to Output GST — ' ||
           case when company_state_code() is null then 'add the company GSTIN in Settings' else 'the client GSTIN or state is missing' end,
         sum(l.credit)
  from journal_entries e join journal_lines l on l.entry_id = e.id join gl_accounts a on a.id = l.gl_account_id
  where e.source_table = 'invoices' and a.code = '2030'
  having count(*) > 0

  union all
  select 'ITC_UNSPLIT', 'info', 'Input GST not split into CGST / SGST / IGST',
         'Vendor bills posted to the general input-GST account — add the supplier''s GSTIN.', sum(l.debit - l.credit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id
  where a.code = '1050' having sum(l.debit - l.credit) > 0.01

  union all
  select 'BILL_GST_NO_GSTIN', 'warning', 'GST charged by a vendor with no GSTIN — input credit cannot be claimed',
         coalesce(b.display_id, '') || ' — ' || coalesce(v.name, ''), round(b.amount * b.gst_pct / 100, 2)
  from vendor_bills b join vendors v on v.id = b.vendor_id
  where b.gst_pct > 0 and coalesce(trim(v.gstin), '') = ''

  union all
  select 'TDS_NO_PAN', 'warning', 'TDS deducted from a vendor with no PAN (Section 206AA — higher rate applies)',
         coalesce(b.display_id, '') || ' — ' || coalesce(v.name, ''), round((b.amount + coalesce(b.other_cost, 0)) * b.tds_pct / 100, 2)
  from vendor_bills b join vendors v on v.id = b.vendor_id
  where b.tds_pct > 0 and coalesce(trim(v.pan), '') = ''

  union all
  select 'TDS_REMIT', 'warning', 'TDS deducted in an earlier month is not yet paid to the government',
         'TDS is due by the 7th of the following month — pay it with a journal voucher (Dr TDS Payable, Cr Bank).', x.unpaid
  from (
    select coalesce(sum(l.credit) filter (where e.date < date_trunc('month', current_date)), 0) - coalesce(sum(l.debit), 0) as unpaid
    from journal_lines l join journal_entries e on e.id = l.entry_id join gl_accounts a on a.id = l.gl_account_id
    where a.code = '2070'
  ) x
  where x.unpaid > 0.01 and extract(day from current_date) >= 8

  union all
  select 'COMPANY_PROFILE', 'warning', 'Company details incomplete',
         'Missing: ' || concat_ws(', ',
           case when coalesce(trim(gstin), '') = '' then 'GSTIN' end,
           case when coalesce(trim(address), '') = '' then 'address' end,
           case when coalesce(trim(bank_details), '') = '' then 'bank details (printed on invoices)' end), null
  from company_profile
  where coalesce(trim(gstin), '') = '' or coalesce(trim(address), '') = '' or coalesce(trim(bank_details), '') = ''

  union all
  select 'CLIENT_ADDRESS', 'warning', 'Client address or state missing', c.name, null
  from clients c
  where exists (select 1 from invoices i where i.client_id = c.id and i.status = 'sent')
    and (coalesce(trim(c.address_line1), '') = '' or coalesce(trim(c.state), '') = '')

  union all
  select 'CLIENT_GSTIN', 'info', 'Client has no GSTIN (treated as unregistered)', c.name, null
  from clients c
  where exists (select 1 from invoices i where i.client_id = c.id and i.status = 'sent')
    and coalesce(trim(c.gst), '') = ''

  union all
  select 'ADVANCE_HELD', 'info', 'Advance from customer not yet adjusted against an invoice', coalesce(c.name, ''), sum(l.credit - l.debit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id left join clients c on c.id = l.client_id
  where a.code = '2060'
  group by c.name having sum(l.credit - l.debit) > 0.01

  union all
  select 'TDS_RECON', 'info', 'TDS receivable to reconcile with Form 26AS',
         'Booked on invoices; match each client''s total against the deductions shown in Form 26AS.', sum(l.debit - l.credit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id
  where a.code = '1040' having sum(l.debit - l.credit) > 0.01

  union all
  select 'NO_LOCK', 'info', 'No financial year is locked',
         'Lock a closed year in Settings so its entries cannot be changed.', null
  from company_profile where books_locked_until is null
$$;
