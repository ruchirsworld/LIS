import { useState } from 'react'
import { useExpenses } from '../../lib/queries/expenses'
import { useExpenseCategories } from '../../lib/queries/masters'
import { matchesCategoryLabel } from '../../lib/labels'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

const UNASSIGNED = 'Unassigned'

export function GeneralExpenseSummary({ range }: { range: DateRange | null }) {
  const { data: expenses } = useExpenses(range)
  const { data: categories } = useExpenseCategories()
  const [selectedCC, setSelectedCC] = useState<string | null>(null)

  // "General expenses" here means Category = General (the toggle option on
  // the expense form), so its recognized tags come from the CoA category of
  // the same name.
  const generalCategory = categories?.find((c) => matchesCategoryLabel(c.name, 'General'))
  const adminTags = new Set((generalCategory?.tags ?? []).map((t) => t.toLowerCase()))

  const generalExpenses = (expenses ?? []).filter((e) => e.type === 'General')

  const byCostCenter = new Map<string, number>()
  generalExpenses.forEach((e) => {
    const key = e.cost_center ?? UNASSIGNED
    byCostCenter.set(key, (byCostCenter.get(key) ?? 0) + Number(e.amount || 0))
  })
  const costCenterRows = Array.from(byCostCenter.entries()).sort((a, b) => b[1] - a[1])

  const tagScoped = selectedCC ? generalExpenses.filter((e) => (e.cost_center ?? UNASSIGNED) === selectedCC) : generalExpenses

  const byTag = new Map<string, number>()
  tagScoped.forEach((e) => {
    const matches = (e.description || '').match(/#\w+/g) ?? []
    const recognized = matches.filter((t) => adminTags.has(t.slice(1).toLowerCase()))
    if (recognized.length === 0) {
      byTag.set('Untagged', (byTag.get('Untagged') ?? 0) + Number(e.amount || 0))
      return
    }
    recognized.forEach((t) => byTag.set(t, (byTag.get(t) ?? 0) + Number(e.amount || 0)))
  })
  const tagRows = Array.from(byTag.entries()).sort((a, b) => b[1] - a[1])

  const sections: ExportSection[] = [
    { title: 'By cost center', columns: ['Cost center', 'Amount'], rows: costCenterRows.map(([c, a]) => [c, a]) },
    {
      title: selectedCC ? `By tag — ${selectedCC}` : 'By tag — all cost centers',
      columns: ['Tag', 'Amount'],
      rows: tagRows.map(([t, a]) => [t, a]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>General expense summary</summary>
      <ReportExportButtons title="General expense summary" sections={sections} range={range} />

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        By cost center
      </div>
      <div className="dash-grid">
        <button
          type="button"
          className="dash-card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: selectedCC === null ? 'var(--accent)' : undefined,
            background: selectedCC === null ? 'var(--accent-soft)' : undefined,
          }}
          onClick={() => setSelectedCC(null)}
        >
          <div className="dash-label">All</div>
          <div className="dash-value">{fmt(generalExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}</div>
        </button>
        {costCenterRows.map(([center, amount]) => (
          <button
            key={center}
            type="button"
            className="dash-card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: selectedCC === center ? 'var(--accent)' : undefined,
              background: selectedCC === center ? 'var(--accent-soft)' : undefined,
            }}
            onClick={() => setSelectedCC(selectedCC === center ? null : center)}
          >
            <div className="dash-label">{center}</div>
            <div className="dash-value">{fmt(amount)}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        By tag {selectedCC ? `— ${selectedCC}` : '— all cost centers'}
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Tag</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {tagRows.length === 0 && (
              <tr>
                <td colSpan={2} className="empty-row">
                  No general expenses in this period
                </td>
              </tr>
            )}
            {tagRows.map(([tag, amount]) => (
              <tr key={tag}>
                <td>{tag}</td>
                <td className="amt">{fmt(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
