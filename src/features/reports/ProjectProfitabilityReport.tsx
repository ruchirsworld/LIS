import { useProjects, useClients } from '../../lib/queries/masters'
import { useExpenses } from '../../lib/queries/expenses'
import { useVendorBills } from '../../lib/queries/purchases'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { netPayable, totalPaid } from '../../lib/calc/invoices'
import { billTotal } from '../../lib/calc/vendorBills'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function ProjectProfitabilityReport({ range }: { range: DateRange | null }) {
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: expenses } = useExpenses(null)
  const { data: bills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()

  const from = range?.from ?? null
  const to = range?.to ?? null

  const rows = (projects ?? []).map((p) => {
    const client = clients?.find((c) => c.id === p.client_id)

    const projInvoices = (invoices ?? []).filter((i) => i.project_id === p.id && inRange(i.invoice_date, from, to))
    const invoiced = projInvoices.reduce((s, i) => s + netPayable(i), 0)

    const invoiceIds = new Set(projInvoices.map((i) => i.id))
    const projPayments = (payments ?? []).filter((pay) => invoiceIds.has(pay.invoice_id))
    const received = totalPaid(projPayments)

    const projExpenses = (expenses ?? []).filter((e) => e.project_id === p.id && inRange(e.date, from, to))
    const expenseTotal = projExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    const projBills = (bills ?? []).filter((b) => b.project_id === p.id && inRange(b.date, from, to))
    const billTotalSum = projBills.reduce((s, b) => s + billTotal(b), 0)

    const profit = invoiced - expenseTotal - billTotalSum

    return { id: p.id, name: p.name, client: clientLabel(client), invoiced, received, expenseTotal, billTotalSum, profit }
  })

  const sections: ExportSection[] = [
    {
      title: 'Project profitability',
      columns: ['Project', 'Client', 'Invoiced', 'Received', 'Expenses', 'Vendor bills', 'Profit'],
      rows: rows.map((r) => [r.name, r.client, r.invoiced, r.received, r.expenseTotal, r.billTotalSum, r.profit]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Project profitability</summary>
      <ReportExportButtons title="Project profitability" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th style={{ textAlign: 'right' }}>Invoiced</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Vendor bills</th>
              <th style={{ textAlign: 'right' }}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No projects yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.client}</td>
                <td className="amt">{fmt(r.invoiced)}</td>
                <td className="amt">{fmt(r.received)}</td>
                <td className="amt">{fmt(r.expenseTotal)}</td>
                <td className="amt">{fmt(r.billTotalSum)}</td>
                <td className="amt">{fmt(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
