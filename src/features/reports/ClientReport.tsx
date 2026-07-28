import { useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { netPayable, totalPaid, dueAmount } from '../../lib/calc/invoices'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function ClientReport({ range }: { range: DateRange | null }) {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()

  const relevantClients = clients?.filter((c) => invoices?.some((i) => i.client_id === c.id)) ?? []

  const rows = relevantClients.map((c) => {
    const clientInvoices = invoices?.filter((i) => i.client_id === c.id) ?? []
    const periodInvoices = clientInvoices.filter((i) => inRange(i.invoice_date, range?.from ?? null, range?.to ?? null))
    const invoicedThisPeriod = periodInvoices.reduce((s, i) => s + netPayable(i), 0)

    const invoiceIds = new Set(clientInvoices.map((i) => i.id))
    const clientPayments = payments?.filter((p) => invoiceIds.has(p.invoice_id)) ?? []
    const periodPayments = clientPayments.filter((p) => inRange(p.date, range?.from ?? null, range?.to ?? null))
    const receivedThisPeriod = totalPaid(periodPayments)

    const dueToDate = clientInvoices.reduce((s, i) => {
      const invPayments = clientPayments.filter((p) => p.invoice_id === i.id)
      return s + dueAmount(i, invPayments)
    }, 0)

    return { id: c.id, name: clientLabel(c), invoicedThisPeriod, receivedThisPeriod, dueToDate }
  })

  const sections: ExportSection[] = [
    {
      title: 'Client report',
      columns: ['Client', 'Invoiced (period)', 'Received (period)', 'Due (to date)'],
      rows: rows.map((r) => [r.name, r.invoicedThisPeriod, r.receivedThisPeriod, r.dueToDate]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Client report</summary>
      <ReportExportButtons title="Client report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Client</th>
              <th style={{ textAlign: 'right' }}>Invoiced (period)</th>
              <th style={{ textAlign: 'right' }}>Received (period)</th>
              <th style={{ textAlign: 'right' }}>Due (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No invoices yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="amt">{fmt(r.invoicedThisPeriod)}</td>
                <td className="amt">{fmt(r.receivedThisPeriod)}</td>
                <td className="amt">{fmt(r.dueToDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
