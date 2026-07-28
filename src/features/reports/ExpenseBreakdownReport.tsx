import { useReportSummary } from '../../lib/queries/reports'
import { useExpenses } from '../../lib/queries/expenses'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function ExpenseBreakdownReport({ range }: { range: DateRange | null }) {
  const { data: summary } = useReportSummary(range)
  const { data: expenses } = useExpenses(range)

  const byCostCenter = new Map<string, number>()
  expenses?.forEach((e) => {
    const key = e.cost_center ?? 'Unassigned'
    byCostCenter.set(key, (byCostCenter.get(key) ?? 0) + Number(e.amount || 0))
  })
  const costCenterRows = Array.from(byCostCenter.entries()).sort((a, b) => b[1] - a[1])

  const sections: ExportSection[] = [
    {
      title: 'By category',
      columns: ['Category', 'Amount'],
      rows: (summary?.expenses_by_type ?? []).map((row) => [row.type, row.amount]),
    },
    {
      title: 'By cost center',
      columns: ['Cost center', 'Amount'],
      rows: costCenterRows.map(([center, amount]) => [center, amount]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Expense breakdown</summary>
      <ReportExportButtons title="Expense breakdown" sections={sections} range={range} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 260px' }}>
          <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
            By category
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(!summary?.expenses_by_type || summary.expenses_by_type.length === 0) && (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      No expenses in this period
                    </td>
                  </tr>
                )}
                {summary?.expenses_by_type.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td className="amt">{fmt(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
    </details>
  )
}
