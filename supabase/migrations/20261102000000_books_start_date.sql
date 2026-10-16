-- Cash & bank counts each account only from the day its opening balance was entered.
--
-- Entries are being made from the newest month back to the oldest. Until now Cash & bank added up EVERY dated
-- entry, so a half-finished back-fill showed a wrong figure. Now every account (Cash, Kotak, CBI ...) has a
-- "books start" date: the date of its opening balance (account_openings.as_on).
--
--  * Balance = the opening balance + every entry dated on or after that day. Older entries stay saved and visible
--    on their own screens; they are simply not counted yet.
--  * An account with no opening balance is left out (its balance is "not set"), not guessed.
--  * The Dashboard figure and the "below zero" check use it. The Balance Sheet, client outstanding, retention,
--    vendor dues and profit & loss are unchanged.

create or replace function cash_bank_position()
returns table (
  bank_account_id uuid,   -- null = Cash in hand
  account_name text,
  started_on date,        -- the opening balance's date; null = no opening balance set
  opening numeric,
  balance numeric,        -- null when no opening balance is set
  uncounted_entries bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with accts as (
    select null::uuid as id, 'Cash'::text as name
    union all
    select b.id, b.name from bank_accounts b
  ),
  moves as (
    select l.bank_account_id, l.debit, l.credit, je.date
    from journal_lines l
    join journal_entries je on je.id = l.entry_id
    join gl_accounts a on a.id = l.gl_account_id
    where a.code in ('1010', '1020')
  )
  select a.id,
         a.name,
         o.as_on,
         o.amount,
         case when o.id is null then null
              else coalesce((select sum(m.debit - m.credit) from moves m where m.bank_account_id is not distinct from a.id and m.date >= o.as_on), 0)
         end,
         (select count(*) from moves m where m.bank_account_id is not distinct from a.id and (o.id is null or m.date < o.as_on))
  from accts a
  left join account_openings o on o.bank_account_id is not distinct from a.id
$function$;

revoke execute on function cash_bank_position() from public, anon;
grant execute on function cash_bank_position() to authenticated;

-- ── Dashboard: the Cash & bank figure ─────────────────────────────────────
create or replace view v_dashboard_kpis as
 SELECT ( SELECT COALESCE(sum(GREATEST((((v_invoice_computed.net_payable - v_invoice_computed.retention_amount) - (v_invoice_computed.total_paid - v_invoice_computed.released_paid)) - v_invoice_computed.gst_held), (0)::numeric)), (0)::numeric) AS "coalesce"
           FROM v_invoice_computed
          WHERE (v_invoice_computed.status = 'sent'::invoice_status)) AS outstanding_from_clients,
    ( SELECT COALESCE(sum(expenses.amount), (0)::numeric) AS "coalesce"
           FROM expenses
          WHERE ((date_trunc('month'::text, (expenses.date)::timestamp without time zone) = date_trunc('month'::text, (CURRENT_DATE)::timestamp without time zone)) AND (expenses.status = 'approved'::text))) AS expenses_this_month,
    ( SELECT count(*) AS count
           FROM projects
          WHERE (projects.status = 'active'::project_status)) AS active_projects,
    ( SELECT count(*) AS count
           FROM clients) AS clients_count,
    ( SELECT COALESCE(sum((v_vendor_bill_computed.payable - v_vendor_bill_computed.paid)), (0)::numeric) AS "coalesce"
           FROM v_vendor_bill_computed) AS owed_to_vendors,
    ( SELECT COALESCE(sum(v_loan_computed.outstanding), (0)::numeric) AS "coalesce"
           FROM v_loan_computed) AS loan_principal_outstanding,
    ( SELECT COALESCE(sum(
                CASE
                    WHEN (capital_transactions.type = 'injection'::capital_tx_type) THEN capital_transactions.amount
                    ELSE (- capital_transactions.amount)
                END), (0)::numeric) AS "coalesce"
           FROM capital_transactions) AS net_partner_capital,
    ( SELECT COALESCE(sum(p.balance), (0)::numeric) AS "coalesce"
           FROM cash_bank_position() p) AS cash_and_bank_balance,
    ( SELECT count(*) AS count
           FROM v_invoice_status
          WHERE ((v_invoice_status.effective_status = 'overdue'::text) AND (v_invoice_status.status = 'sent'::invoice_status))) AS overdue_invoices_count,
    ( SELECT COALESCE(sum(v_invoice_status.due_amount), (0)::numeric) AS "coalesce"
           FROM v_invoice_status
          WHERE ((v_invoice_status.effective_status = 'overdue'::text) AND (v_invoice_status.status = 'sent'::invoice_status))) AS overdue_invoices_amount,
    ( SELECT COALESCE(sum(v_invoice_computed.gst_held), (0)::numeric) AS "coalesce"
           FROM v_invoice_computed
          WHERE (v_invoice_computed.status = 'sent'::invoice_status)) AS gst_held_by_clients;

alter view v_dashboard_kpis set (security_invoker = true);

-- ── Books health: "below zero" per account, from its start date; and a note for accounts with no opening ──
create or replace function books_health_check()
returns table(check_code text, severity text, title text, detail text, amount numeric)
language sql
stable
set search_path to 'public'
as $function$
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
  select 'NEGATIVE_CASH', 'error', p.account_name || ' has a negative balance',
         'Cash or bank cannot be below zero — a receipt or opening balance is missing (counted from ' || to_char(p.started_on, 'DD Mon YYYY') || ').',
         p.balance
  from cash_bank_position() p
  where p.balance < -0.005

  union all
  select 'OPENING_MISSING', 'warning', p.account_name || ' has no opening balance',
         p.uncounted_entries || ' entr' || case when p.uncounted_entries = 1 then 'y is' else 'ies are' end ||
           ' not counted in Cash & bank until you set its opening balance (Reports > Opening and monthly balances).',
         null
  from cash_bank_position() p
  where p.started_on is null and p.uncounted_entries > 0

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
  select 'GST_FILED_NOT_SENT', 'warning', 'GST deposited but proof (Form 3B) not yet sent to the client',
         coalesce(c.name, '') || ' - ' || count(*) || ' invoice(s)', sum(v.gst_held)
  from v_invoice_computed v join invoices i on i.id = v.id left join clients c on c.id = v.client_id
  where v.gst_held > 0.01 and i.gstr3b_filed_on is not null and i.gstr3b_sent_on is null
  group by c.name

  union all
  select 'GST_RELEASE_PENDING', 'warning', 'GST proof sent over 30 days ago but not yet released by the client',
         coalesce(c.name, '') || ' - ' || count(*) || ' invoice(s)', sum(v.gst_held)
  from v_invoice_computed v join invoices i on i.id = v.id left join clients c on c.id = v.client_id
  where v.gst_held > 0.01 and i.gstr3b_sent_on < current_date - 30
  group by c.name

  union all
  select 'GST_NOT_DEPOSITED', 'info', 'GST held by the client, not yet filed in GSTR-3B',
         coalesce(c.name, '') || ' - ' || count(*) || ' invoice(s)', sum(v.gst_held)
  from v_invoice_computed v join invoices i on i.id = v.id left join clients c on c.id = v.client_id
  where v.gst_held > 0.01 and i.gstr3b_filed_on is null
  group by c.name

  union all
  select 'NO_LOCK', 'info', 'No financial year is locked',
         'Lock a closed year in Settings so its entries cannot be changed.', null
  from company_profile where books_locked_until is null
$function$;
