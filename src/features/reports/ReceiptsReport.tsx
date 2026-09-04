import { useClients, useBankAccounts } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { inRange } from '../../lib/calc/period'
import { fmt, fmtDate } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

/** A flat register of every receipt (invoice payment) recorded in the
 * period — the "Record receipts" form (Invoices page) only has each one
 * nested under its own invoice's payment history, with no single place to
 * see everything received in a date range at a glance. */
export function ReceiptsReport({ range }: { range: DateRange | null }) {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const { data: bankAccounts } = useBankAccounts()

  const invoiceById = new Map((invoices ?? []).map((i) => [i.id, i]))
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]))
  const bankAccountName = (id: string | null) => (id ? bankAccounts?.find((a) => a.id === id)?.name ?? '—' : 'Cash')

  const rows = (payments ?? [])
    .filter((p) => inRange(p.date, range?.from ?? null, range?.to ?? null))
    .map((p) => {
      const invoice = invoiceById.get(p.invoice_id)
      const client = invoice ? clientById.get(invoice.client_id) : undefined
      return {
        id: p.id,
        date: p.date,
        clientName: client ? clientLabel(client) : '—',
        invoiceLabel: invoice?.display_id ?? invoice?.invoice_number ?? '—',
        amount: Number(p.amount || 0),
        account: bankAccountName(p.bank_account_id),
        reference: p.reference ?? '—',
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = rows.reduce((s, r) => s + r.amount, 0)

  const sections: ExportSection[] = [
    {
      title: 'Receipts',
      columns: ['Date', 'Client', 'Invoice', 'Amount', 'Account', 'Reference'],
      rows: rows.map((r) => [fmtDate(r.date), r.clientName, r.invoiceLabel, r.amount, r.account, r.reference]),
    },
  ]

  return (
    <div className="report-panel">
      <ReportExportButtons title="Receipts" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Invoice</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Account</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No receipts in this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.clientName}</td>
                <td>{r.invoiceLabel}</td>
                <td className="amt">{fmt(r.amount)}</td>
                <td>{r.account}</td>
                <td>{r.reference}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td className="amt">
                  <strong>{fmt(total)}</strong>
                </td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
