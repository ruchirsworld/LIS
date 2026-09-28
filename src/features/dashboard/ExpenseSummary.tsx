import { useState } from 'react'
import { useExpenses } from '../../lib/queries/expenses'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

const UNASSIGNED_CC = 'Unassigned'

interface DetailRow {
  id: string
  date: string
  description: string
  remarks: string
  amount: number
}

export function ExpenseSummary({ range }: { range: DateRange | null }) {
  const { data: expenses } = useExpenses(range)
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(null)

  const byCostCenter = new Map<string, number>()
  ;(expenses ?? []).forEach((e) => {
    const key = e.cost_center ?? UNASSIGNED_CC
    byCostCenter.set(key, (byCostCenter.get(key) ?? 0) + Number(e.amount || 0))
  })
  const costCenterRows = Array.from(byCostCenter.entries()).sort((a, b) => b[1] - a[1])

  const scoped = selectedCostCenter
    ? (expenses ?? []).filter((e) => (e.cost_center ?? UNASSIGNED_CC) === selectedCostCenter)
    : expenses ?? []

  const rows: DetailRow[] = scoped
    .map((e) => ({
      id: e.display_id ?? '',
      date: e.date,
      description: e.description || '—',
      remarks: e.remarks || '—',
      amount: Number(e.amount || 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  const sections: ExportSection[] = [
    {
      title: 'By cost center',
      columns: ['Cost center', 'Amount'],
      rows: costCenterRows.map(([c, a]) => [c, a]),
    },
    {
      title: 'Expense details',
      columns: ['ID', 'Date', 'Description', 'Remarks', 'Amount'],
      rows: rows.map((r) => [r.id, fmtDate(r.date), r.description, r.remarks, r.amount]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Expense summary</summary>
      <ReportExportButtons title="Expense summary" sections={sections} range={range} />

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        By cost center
      </div>
      <div className="dash-grid">
        {costCenterRows.map(([center, amount]) => (
          <button
            key={center}
            type="button"
            className="dash-card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: selectedCostCenter === center ? 'var(--accent)' : undefined,
              background: selectedCostCenter === center ? 'var(--accent-soft)' : undefined,
            }}
            onClick={() => setSelectedCostCenter(selectedCostCenter === center ? null : center)}
          >
            <div className="dash-label">{center}</div>
            <div className="dash-value">{fmt(amount)}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        Expense details{selectedCostCenter ? ` — ${selectedCostCenter}` : ''}
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Description</th>
              <th>Remarks</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No expenses in this period
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.id || '—'}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.description}</td>
                <td>{r.remarks}</td>
                <td className="amt">{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
