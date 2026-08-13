import { Fragment, useState } from 'react'
import { useExpenses, useExpenseReimbursements } from '../../lib/queries/expenses'
import { useCostCenters } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { expenseDue } from '../../lib/calc/expenses'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { SettleReimbursementForm } from './SettleReimbursementForm'

const UNKNOWN_USER = 'Unknown'
const UNASSIGNED_CC = 'Unassigned'

interface TagRow {
  tag: string
  id: string
  date: string
  amount: number
}

export function ExpenseSummary({ range }: { range: DateRange | null }) {
  const { data: expenses } = useExpenses(range)
  // Independent of the period filter — "amount still to claim" is a running
  // total, not scoped to whatever date range is currently selected.
  const { data: allExpenses } = useExpenses(null)
  const { data: costCenters } = useCostCenters()
  const { data: profiles } = useProfiles()
  const { data: reimbursements } = useExpenseReimbursements()
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(null)
  const [settlingUserId, setSettlingUserId] = useState<string>('')

  interface DueUserRow {
    userId: string | null
    name: string
    due: number
    outstanding: { id: string; due: number; date: string }[]
  }
  const dueByUserId = new Map<string, DueUserRow>()
  ;(allExpenses ?? []).forEach((e) => {
    if (!e.reimbursable) return
    const due = expenseDue(e.amount, (reimbursements ?? []).filter((r) => r.expense_id === e.id))
    if (due <= 0) return
    const key = e.created_by ?? 'unknown'
    const name = (e.created_by && profiles?.find((p) => p.id === e.created_by)?.name) || UNKNOWN_USER
    const existing = dueByUserId.get(key)
    if (existing) {
      existing.due += due
      existing.outstanding.push({ id: e.id, due, date: e.date })
    } else {
      dueByUserId.set(key, { userId: e.created_by, name, due, outstanding: [{ id: e.id, due, date: e.date }] })
    }
  })
  dueByUserId.forEach((row) => row.outstanding.sort((a, b) => a.date.localeCompare(b.date)))
  const dueByUserRows = Array.from(dueByUserId.values()).sort((a, b) => b.due - a.due)
  const totalDue = dueByUserRows.reduce((s, r) => s + r.due, 0)

  const tagsOf = (costCenterName: string | null) => {
    const cc = costCenters?.find((c) => c.name === costCenterName)
    return new Set((cc?.tags ?? []).map((t) => t.toLowerCase()))
  }

  const byCostCenter = new Map<string, number>()
  ;(expenses ?? []).forEach((e) => {
    const key = e.cost_center ?? UNASSIGNED_CC
    byCostCenter.set(key, (byCostCenter.get(key) ?? 0) + Number(e.amount || 0))
  })
  const costCenterRows = Array.from(byCostCenter.entries()).sort((a, b) => b[1] - a[1])

  const scoped = selectedCostCenter
    ? (expenses ?? []).filter((e) => (e.cost_center ?? UNASSIGNED_CC) === selectedCostCenter)
    : expenses ?? []

  const rows: TagRow[] = []
  scoped.forEach((e) => {
    const adminTags = tagsOf(e.cost_center)
    // \S+ (not \w+) so tags with punctuation like "#F&B" match in full —
    // \w+ stops at the "&", leaving just "#F" which never matches "F&B".
    const matches = (e.description || '').match(/#\S+/g) ?? []
    const recognized = matches.filter((t) => adminTags.has(t.slice(1).toLowerCase()))
    const tags = recognized.length > 0 ? recognized : ['Untagged']
    tags.forEach((tag) => rows.push({ tag, id: e.display_id ?? '', date: e.date, amount: Number(e.amount || 0) }))
  })
  rows.sort((a, b) => a.tag.localeCompare(b.tag) || b.date.localeCompare(a.date))

  const sections: ExportSection[] = [
    {
      title: 'By cost center',
      columns: ['Cost center', 'Amount'],
      rows: costCenterRows.map(([c, a]) => [c, a]),
    },
    {
      title: 'By tag',
      columns: ['Tag', 'ID', 'Date', 'Amount'],
      rows: rows.map((r) => [r.tag, r.id, fmtDate(r.date), r.amount]),
    },
    {
      title: 'Reimbursement due by user',
      columns: ['User', 'Amount due'],
      rows: dueByUserRows.map((r) => [r.name, r.due]),
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
        By tag{selectedCostCenter ? ` — ${selectedCostCenter}` : ''}
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

      {dueByUserRows.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 16, marginBottom: 8 }}>
            Reimbursement due by user — total {fmt(totalDue)}
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ textAlign: 'right' }}>Amount due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dueByUserRows.map((r) => {
                  const rowKey = r.userId ?? 'unknown'
                  return (
                    <Fragment key={rowKey}>
                      <tr>
                        <td>{r.name}</td>
                        <td className="amt">{fmt(r.due)}</td>
                        <td>
                          <button
                            type="button"
                            className="pay-btn"
                            disabled={!r.userId}
                            onClick={() => setSettlingUserId(settlingUserId === rowKey ? '' : rowKey)}
                          >
                            Settle
                          </button>
                        </td>
                      </tr>
                      {settlingUserId === rowKey && (
                        <SettleReimbursementForm
                          due={r.due}
                          outstandingExpenses={r.outstanding}
                          colSpan={3}
                          onClose={() => setSettlingUserId('')}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  )
}
