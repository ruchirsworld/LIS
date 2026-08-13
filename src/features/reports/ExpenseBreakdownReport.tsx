import { useExpenses } from '../../lib/queries/expenses'
import { useProjects, useClients, useVendors } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function ExpenseBreakdownReport({ range }: { range: DateRange | null }) {
  const { data: expenses } = useExpenses(range)
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()

  const byCostCenter = new Map<string, number>()
  expenses?.forEach((e) => {
    const key = e.cost_center ?? 'Unassigned'
    byCostCenter.set(key, (byCostCenter.get(key) ?? 0) + Number(e.amount || 0))
  })
  const costCenterRows = Array.from(byCostCenter.entries()).sort((a, b) => b[1] - a[1])

  const projLabelOf = (e: NonNullable<typeof expenses>[number]) => {
    const project = projects?.find((p) => p.id === e.project_id)
    const client = project ? clients?.find((c) => c.id === project.client_id) : null
    return project ? `${project.name} — ${clientLabel(client)}` : ''
  }
  const vendorNameOf = (e: NonNullable<typeof expenses>[number]) => {
    const vendor = e.vendor_id ? vendors?.find((v) => v.id === e.vendor_id) : null
    return vendor?.name ?? ''
  }

  const sections: ExportSection[] = [
    {
      title: 'By cost center',
      columns: ['Cost center', 'Amount'],
      rows: costCenterRows.map(([center, amount]) => [center, amount]),
    },
    {
      title: 'Expense records',
      columns: ['ID', 'Date', 'Description', 'Amount', 'Vendor', 'Project / client', 'Cost center', 'Reimbursable'],
      rows: (expenses ?? []).map((e) => [
        e.display_id ?? '',
        fmtDate(e.date),
        e.description,
        e.amount,
        vendorNameOf(e),
        projLabelOf(e),
        e.cost_center ?? '',
        e.reimbursable ? 'Yes' : 'No',
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Expense breakdown</summary>
      <ReportExportButtons title="Expense breakdown" sections={sections} range={range} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 260px' }}>
          <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
            By cost center
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Cost center</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {costCenterRows.length === 0 && (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      No expenses in this period
                    </td>
                  </tr>
                )}
                {costCenterRows.map(([center, amount]) => (
                  <tr key={center}>
                    <td>{center}</td>
                    <td className="amt">{fmt(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="note" style={{ marginTop: 16, marginBottom: 8 }}>
        Expense records
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Vendor</th>
              <th>Project / client</th>
              <th>Cost center</th>
              <th>Reimb.</th>
            </tr>
          </thead>
          <tbody>
            {(!expenses || expenses.length === 0) && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No expenses in this period
                </td>
              </tr>
            )}
            {expenses?.map((e) => (
              <tr key={e.id}>
                <td>{e.display_id ?? '—'}</td>
                <td>{fmtDate(e.date)}</td>
                <td>{e.description}</td>
                <td className="amt">{fmt(e.amount)}</td>
                <td>{vendorNameOf(e) || '—'}</td>
                <td>{projLabelOf(e) || '—'}</td>
                <td>{e.cost_center ?? '—'}</td>
                <td>{e.reimbursable ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
