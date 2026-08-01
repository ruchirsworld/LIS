import { useState } from 'react'
import { useExpenses } from '../../lib/queries/expenses'
import { useExpenseCategories } from '../../lib/queries/masters'
import { matchesCategoryLabel } from '../../lib/labels'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

// The three "masterheads" — the toggle-category on the expense form, and
// what every expense's `type` column is set to.
const CATEGORIES = ['General', 'Purchase', 'Project'] as const

interface TagRow {
  tag: string
  id: string
  date: string
  amount: number
}

export function ExpenseSummary({ range }: { range: DateRange | null }) {
  const { data: expenses } = useExpenses(range)
  const { data: categories } = useExpenseCategories()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const tagsOf = (typeName: string) => {
    const cat = categories?.find((c) => matchesCategoryLabel(c.name, typeName))
    return new Set((cat?.tags ?? []).map((t) => t.toLowerCase()))
  }

  const byCategory = new Map<string, number>()
  ;(expenses ?? []).forEach((e) => {
    byCategory.set(e.type, (byCategory.get(e.type) ?? 0) + Number(e.amount || 0))
  })
  const categoryRows: [string, number][] = CATEGORIES.map((c) => [c, byCategory.get(c) ?? 0])
  const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount || 0), 0)

  const scoped = selectedCategory ? (expenses ?? []).filter((e) => e.type === selectedCategory) : expenses ?? []

  const rows: TagRow[] = []
  scoped.forEach((e) => {
    const adminTags = tagsOf(e.type)
    const matches = (e.description || '').match(/#\w+/g) ?? []
    const recognized = matches.filter((t) => adminTags.has(t.slice(1).toLowerCase()))
    const tags = recognized.length > 0 ? recognized : ['Untagged']
    tags.forEach((tag) => rows.push({ tag, id: e.display_id ?? '', date: e.date, amount: Number(e.amount || 0) }))
  })
  rows.sort((a, b) => a.tag.localeCompare(b.tag) || b.date.localeCompare(a.date))

  const sections: ExportSection[] = [
    { title: 'By category', columns: ['Category', 'Amount'], rows: categoryRows.map(([c, a]) => [c, a]) },
    {
      title: selectedCategory ? `By tag — ${selectedCategory}` : 'By tag — all categories',
      columns: ['Tag', 'ID', 'Date', 'Amount'],
      rows: rows.map((r) => [r.tag, r.id, fmtDate(r.date), r.amount]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Expense summary</summary>
      <ReportExportButtons title="Expense summary" sections={sections} range={range} />

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        By category
      </div>
      <div className="dash-grid">
        <button
          type="button"
          className="dash-card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: selectedCategory === null ? 'var(--accent)' : undefined,
            background: selectedCategory === null ? 'var(--accent-soft)' : undefined,
          }}
          onClick={() => setSelectedCategory(null)}
        >
          <div className="dash-label">All</div>
          <div className="dash-value">{fmt(total)}</div>
        </button>
        {categoryRows.map(([cat, amount]) => (
          <button
            key={cat}
            type="button"
            className="dash-card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: selectedCategory === cat ? 'var(--accent)' : undefined,
              background: selectedCategory === cat ? 'var(--accent-soft)' : undefined,
            }}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
          >
            <div className="dash-label">{cat}</div>
            <div className="dash-value">{fmt(amount)}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
        By tag {selectedCategory ? `— ${selectedCategory}` : '— all categories'}
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Tag</th>
              <th>ID</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No expenses in this period
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.tag}</td>
                <td>{r.id || '—'}</td>
                <td>{fmtDate(r.date)}</td>
                <td className="amt">{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
