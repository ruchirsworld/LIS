import { fmtDate } from '../../lib/calc/format'
import { netPayable, retentionAmt, retentionHeld, round2 } from '../../lib/calc/invoices'
import { financialYearOf, stateLabelOfGstin } from '../../lib/gst'
import { clientFullName, clientLabel } from '../../lib/labels'
import type { DateRange } from '../../lib/calc/period'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']
type InvoiceNote = Database['public']['Tables']['invoice_notes']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Company = Database['public']['Tables']['company_profile']['Row']

/** ₹ with paise, Indian digit grouping - a ledger has to foot to the paisa. */
export function fmtMoney2(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** The running balance, the way a ledger prints it: the figure plus Dr/Cr side. */
function fmtBalance(balance: number): string {
  const rounded = round2(balance)
  if (Math.abs(rounded) < 0.005) return '₹0.00'
  return `${fmtMoney2(Math.abs(rounded))} ${rounded > 0 ? 'Dr' : 'Cr'}`
}

function periodLabel(range: DateRange | null): string {
  if (!range?.from && !range?.to) return 'All periods'
  const fy = range.from ? financialYearOf(range.from) : null
  const sameFy = range.from && range.to && financialYearOf(range.to) === fy
  const span = range.from && range.to ? `${fmtDate(range.from)} to ${fmtDate(range.to)}` : range.from ? `From ${fmtDate(range.from)}` : `Up to ${fmtDate(range.to)}`
  return sameFy ? `${span} (Financial year ${fy})` : span
}

function addressLine(c: Client): string {
  return [c.address_line1, c.city, c.state, c.pincode].map((p) => String(p ?? '').trim()).filter(Boolean).join(', ')
}

/** The header line printed above every ledger download: the business's own identity. */
export function companyHeaderLine(company: Company | null | undefined): string | undefined {
  if (!company) return undefined
  const parts = [company.name, company.gstin ? `GSTIN ${company.gstin}` : '', company.udyam_no ? `Udyam ${company.udyam_no}` : ''].filter(Boolean)
  return parts.length ? parts.join('   |   ') : undefined
}

interface Entry {
  date: string
  order: number
  type: 'Sales' | 'Receipt' | 'Credit Note' | 'Debit Note'
  particulars: string
  vch: string
  debit: number
  credit: number
}

/**
 * Builds one ledger account per client in the usual Indian party-ledger
 * layout - party name, address, GSTIN and the period at the top; opening
 * balance; each voucher with its type and number; period totals; closing
 * balance. Invoices go in at their full value including GST, with the TDS
 * deducted as its own credit line, so GST and TDS can be read off the ledger
 * and matched to returns and Form 26AS. Credit and debit notes appear as their
 * own vouchers. Retention is deliberately not part of this ledger - it has its
 * own section (a sheet in Excel) right after.
 */
export function buildLedgerSections(args: {
  clients: Client[] | undefined
  invoices: Invoice[] | undefined
  payments: InvoicePayment[] | undefined
  notes: InvoiceNote[] | undefined
  projects: Project[] | undefined
  range: DateRange | null
  clientFilter: string
}): ExportSection[] {
  const { clients, invoices: allInvoices, payments: allPayments, notes: allNotes, projects, range, clientFilter } = args

  const relevantClients = (clients ?? [])
    .filter((c) => !clientFilter || c.id === clientFilter)
    .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)))

  const sections: ExportSection[] = []

  for (const client of relevantClients) {
    const clientInvoices = (allInvoices ?? []).filter((inv) => inv.client_id === client.id && inv.invoice_date)
    const invoiceById = new Map(clientInvoices.map((inv) => [inv.id, inv]))
    const clientPayments = (allPayments ?? []).filter((p) => invoiceById.has(p.invoice_id))
    const clientNotes = (allNotes ?? []).filter((n) => invoiceById.has(n.invoice_id))

    if (clientInvoices.length === 0 && clientPayments.length === 0) continue

    const invNo = (inv: Invoice) => inv.invoice_number ?? inv.display_id ?? ''
    const entries: Entry[] = []

    for (const inv of clientInvoices) {
      const gst = round2((inv.amount * Number(inv.gst_pct || 0)) / 100)
      const tds = round2((inv.amount * Number(inv.tds_pct || 0)) / 100)
      const projectName = inv.project_id ? projects?.find((p) => p.id === inv.project_id)?.name : ''
      const taxNote = gst > 0 ? `taxable ${fmtMoney2(inv.amount)} + GST @${inv.gst_pct}% ${fmtMoney2(gst)}` : `taxable ${fmtMoney2(inv.amount)}`
      entries.push({
        date: inv.invoice_date as string,
        order: 0,
        type: 'Sales',
        particulars: `To Sales - Invoice ${invNo(inv)}${projectName ? ` (${projectName})` : ''} - ${taxNote}`,
        vch: invNo(inv),
        debit: round2(inv.amount + gst),
        credit: 0,
      })
      if (tds > 0) {
        entries.push({
          date: inv.invoice_date as string,
          order: 1,
          type: 'Sales',
          particulars: `By TDS receivable @${inv.tds_pct}% - Invoice ${invNo(inv)}`,
          vch: invNo(inv),
          debit: 0,
          credit: tds,
        })
      }
    }

    // One receipt split across several invoices is one voucher.
    const receiptGroups = new Map<string, InvoicePayment[]>()
    for (const p of clientPayments) {
      if (p.receipt_id) receiptGroups.set(p.receipt_id, [...(receiptGroups.get(p.receipt_id) ?? []), p])
    }
    const groupDone = new Set<string>()
    for (const p of clientPayments) {
      const group = p.receipt_id ? receiptGroups.get(p.receipt_id) : undefined
      const mode = p.payment_mode === 'Cash' || !p.bank_account_id ? 'Cash' : 'Bank'
      if (group && group.length > 1) {
        if (groupDone.has(p.receipt_id as string)) continue
        groupDone.add(p.receipt_id as string)
        const ids = group.map((g) => g.display_id ?? '').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        entries.push({
          date: p.date,
          order: 2,
          type: 'Receipt',
          particulars: `By ${mode} - Payment received${p.reference ? ` (${p.reference})` : ''}, split across ${group.length} invoices`,
          vch: `${ids[0]} – ${ids[ids.length - 1]}`,
          debit: 0,
          credit: round2(group.reduce((sum, g) => sum + Number(g.amount || 0), 0)),
        })
        continue
      }
      const against = invoiceById.get(p.invoice_id)
      const advance = against?.invoice_date && p.date < against.invoice_date
      entries.push({
        date: p.date,
        order: 2,
        type: 'Receipt',
        particulars: `By ${mode} - ${advance ? 'Advance' : 'Payment'} received${against ? ` against ${invNo(against)}` : ''}${p.reference ? ` (${p.reference})` : ''}`,
        vch: p.display_id ?? '',
        debit: 0,
        credit: round2(Number(p.amount || 0)),
      })
    }

    for (const n of clientNotes) {
      const inv = invoiceById.get(n.invoice_id)
      const isCredit = n.note_type === 'credit'
      const gross = round2(Number(n.amount) + Number(n.gst_amount))
      entries.push({
        date: n.date,
        order: 3,
        type: isCredit ? 'Credit Note' : 'Debit Note',
        particulars: `${isCredit ? 'By' : 'To'} ${isCredit ? 'Credit' : 'Debit'} note ${n.display_id ?? ''} against ${inv ? invNo(inv) : 'invoice'} - ${n.reason}`,
        vch: n.display_id ?? '',
        debit: isCredit ? 0 : gross,
        credit: isCredit ? gross : 0,
      })
      if (Number(n.tds_amount) > 0) {
        entries.push({
          date: n.date,
          order: 4,
          type: isCredit ? 'Credit Note' : 'Debit Note',
          particulars: `${isCredit ? 'To' : 'By'} TDS receivable @${n.tds_pct}% on ${isCredit ? 'credit' : 'debit'} note ${n.display_id ?? ''}`,
          vch: n.display_id ?? '',
          debit: isCredit ? Number(n.tds_amount) : 0,
          credit: isCredit ? 0 : Number(n.tds_amount),
        })
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)

    const before: Entry[] = []
    const within: Entry[] = []
    for (const e of entries) {
      if (range?.from && e.date < range.from) before.push(e)
      else if (!range?.to || e.date <= range.to) within.push(e)
    }

    const opening = round2(before.reduce((bal, e) => bal + e.debit - e.credit, 0))
    let running = opening
    let totalDebit = 0
    let totalCredit = 0
    const rows: (string | number)[][] = [['', 'Opening balance', '', '', '', '', fmtBalance(opening)]]
    for (const e of within) {
      running = round2(running + e.debit - e.credit)
      totalDebit = round2(totalDebit + e.debit)
      totalCredit = round2(totalCredit + e.credit)
      rows.push([fmtDate(e.date), e.particulars, e.type, e.vch, e.debit || '', e.credit || '', fmtBalance(running)])
    }
    const totalRow = rows.length
    rows.push(['', 'Total for the period', '', '', totalDebit, totalCredit, ''])
    const closingRow = rows.length
    rows.push(['', 'Closing balance', '', '', '', '', fmtBalance(running)])

    const subtitle = [
      clientFullName(client),
      addressLine(client),
      [client.gst ? `GSTIN: ${client.gst}` : 'GSTIN: not registered / not provided', stateLabelOfGstin(client.gst) ? `State: ${stateLabelOfGstin(client.gst)}` : '']
        .filter(Boolean)
        .join('   |   '),
      `Ledger account - ${periodLabel(range)}`,
    ].filter(Boolean)

    sections.push({
      title: clientFullName(client),
      sheetName: clientLabel(client),
      subtitle,
      columns: ['Date', 'Particulars', 'Type', 'Vch No.', 'Debit', 'Credit', 'Balance'],
      rows,
      numericColumns: [4, 5, 6],
      decimals: 2,
      // Wide enough that a full date (23 Apr 2026) never wraps onto a second line.
      columnWidths: { 0: 25, 2: 21, 4: 27, 5: 27, 6: 34 },
      boldRows: [totalRow, closingRow],
      // Voucher numbers stay in the Excel file but are left off the PDF.
      pdfHiddenColumns: [3],
    })

    // The retention workings sit apart from the ledger - the next section in
    // the PDF, the next sheet in Excel: per invoice, net payable x retention %
    // = retention, how much has been released and what is still held.
    const retentionInvoices = clientInvoices
      .filter((inv) => inv.retention_pct)
      .sort((a, b) => (a.invoice_date as string).localeCompare(b.invoice_date as string))
    if (retentionInvoices.length > 0) {
      const lines = retentionInvoices.map((inv) => {
        const invPayments = (allPayments ?? []).filter((p) => p.invoice_id === inv.id)
        const retention = retentionAmt(inv)
        const held = retentionHeld(inv, invPayments)
        return { inv, retention, held, released: Math.max(0, round2(retention - held)) }
      })
      const sum = (pick: (l: (typeof lines)[number]) => number) => round2(lines.reduce((s, l) => s + pick(l), 0))
      sections.push({
        title: `${clientFullName(client)} - Retention calculation`,
        sheetName: `${clientLabel(client)} - Retention`,
        columns: ['Invoice', 'Invoice date', 'Net payable', 'Retention %', 'Retention (net x %)', 'Released', 'Still held', 'Release date'],
        rows: [
          ...lines.map((l) => [
            invNo(l.inv),
            fmtDate(l.inv.invoice_date),
            netPayable(l.inv),
            `${l.inv.retention_pct}%`,
            l.retention,
            l.released,
            l.held,
            l.inv.retention_release_date ? fmtDate(l.inv.retention_release_date) : '-',
          ]),
          ['Total', '', sum((l) => netPayable(l.inv)), '', sum((l) => l.retention), sum((l) => l.released), sum((l) => l.held), ''],
        ],
        numericColumns: [2, 4, 5, 6],
        decimals: 2,
        columnWidths: { 1: 25 },
        boldRows: [lines.length],
        highlightRows: [...lines.flatMap((l, i) => (l.held > 0 ? [i] : [])), ...(sum((l) => l.held) > 0 ? [lines.length] : [])],
      })
    }
  }

  return sections
}
