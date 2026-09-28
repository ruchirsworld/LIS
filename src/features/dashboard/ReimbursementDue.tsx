import { Fragment, useState } from 'react'
import { useExpenses, useExpenseReimbursements } from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments } from '../../lib/queries/purchases'
import { expenseDue, expenseReimbursed, type ReimbursementSource } from '../../lib/calc/expenses'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { SettleReimbursementForm } from './SettleReimbursementForm'

const UNKNOWN_USER = 'Unknown'

interface DueDetail {
  id: string
  displayId: string
  date: string
  description: string
  amount: number
  reimbursed: number
  due: number
}

interface DueUserRow {
  userId: string | null
  name: string
  due: number
  outstanding: { id: string; due: number; date: string; source: ReimbursementSource }[]
  details: DueDetail[]
}

// A running total, not scoped to the dashboard's period filter — "amount
// still to claim" doesn't stop being owed because it's outside the range.
// Hidden entirely when nothing is due.
export function ReimbursementDue() {
  const { data: allExpenses } = useExpenses(null)
  const { data: profiles } = useProfiles()
  const { data: reimbursements } = useExpenseReimbursements()
  const { data: vendorPayments } = useVendorBillPayments()
  const { data: vendorBills } = useVendorBills(null)
  const { data: vendors } = useVendors()
  const [settlingUserId, setSettlingUserId] = useState<string>('')
  const [detailUserId, setDetailUserId] = useState<string>('')

  const dueByUserId = new Map<string, DueUserRow>()
  function addDue(userId: string | null, source: ReimbursementSource, detail: DueDetail) {
    const key = userId ?? 'unknown'
    const outstanding = { id: detail.id, due: detail.due, date: detail.date, source }
    const existing = dueByUserId.get(key)
    if (existing) {
      existing.due += detail.due
      existing.outstanding.push(outstanding)
      existing.details.push(detail)
    } else {
      const name = (userId && profiles?.find((p) => p.id === userId)?.name) || UNKNOWN_USER
      dueByUserId.set(key, { userId, name, due: detail.due, outstanding: [outstanding], details: [detail] })
    }
  }

  ;(allExpenses ?? []).forEach((e) => {
    if (!e.reimbursable) return
    const expenseReimbursements = (reimbursements ?? []).filter((r) => r.expense_id === e.id)
    const due = expenseDue(e.amount, expenseReimbursements)
    if (due <= 0) return
    addDue(e.created_by, 'expense', {
      id: e.id,
      displayId: e.display_id ?? '',
      date: e.date,
      description: e.description || '—',
      amount: Number(e.amount || 0),
      reimbursed: expenseReimbursed(expenseReimbursements),
      due,
    })
  })

  // Vendor payments an employee made out of pocket — owed back the same way.
  ;(vendorPayments ?? []).forEach((p) => {
    if (p.payment_mode !== 'Reimbursement') return
    const paymentReimbursements = (reimbursements ?? []).filter((r) => r.vendor_bill_payment_id === p.id)
    const due = expenseDue(p.amount, paymentReimbursements)
    if (due <= 0) return
    const bill = vendorBills?.find((b) => b.id === p.bill_id)
    const vendorName = vendors?.find((v) => v.id === bill?.vendor_id)?.name ?? 'Vendor'
    addDue(p.paid_by, 'vendor_payment', {
      id: p.id,
      displayId: p.display_id ?? '',
      date: p.date,
      description: `Vendor payment — ${vendorName}${bill?.display_id ? ` (${bill.display_id})` : ''}`,
      amount: Number(p.amount || 0),
      reimbursed: expenseReimbursed(paymentReimbursements),
      due,
    })
  })
  dueByUserId.forEach((row) => {
    row.outstanding.sort((a, b) => a.date.localeCompare(b.date))
    row.details.sort((a, b) => a.date.localeCompare(b.date))
  })
  const dueByUserRows = Array.from(dueByUserId.values()).sort((a, b) => b.due - a.due)
  const totalDue = dueByUserRows.reduce((s, r) => s + r.due, 0)

  if (dueByUserRows.length === 0) return null

  const sections: ExportSection[] = [
    {
      title: 'Reimbursement due by user',
      columns: ['User', 'Amount due'],
      rows: dueByUserRows.map((r) => [r.name, r.due]),
    },
    {
      title: 'Outstanding expenses',
      columns: ['User', 'ID', 'Date', 'Description', 'Amount', 'Reimbursed', 'Due'],
      rows: dueByUserRows.flatMap((r) =>
        r.details.map((d) => [r.name, d.displayId || '—', fmtDate(d.date), d.description, d.amount, d.reimbursed, d.due])
      ),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Reimbursement due — total {fmt(totalDue)}</summary>
      <ReportExportButtons title="Reimbursement due" sections={sections} range={null} />

      <div className="table-scroll" style={{ marginTop: 16 }}>
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
                    <td>
                      <button
                        type="button"
                        className="row-expand-btn"
                        onClick={() => setDetailUserId(detailUserId === rowKey ? '' : rowKey)}
                        aria-label={detailUserId === rowKey ? 'Hide details' : 'Show details'}
                      >
                        {detailUserId === rowKey ? '▾' : '▸'}
                      </button>{' '}
                      <span
                        style={{ cursor: 'pointer', fontWeight: detailUserId === rowKey ? 600 : undefined }}
                        onClick={() => setDetailUserId(detailUserId === rowKey ? '' : rowKey)}
                      >
                        {r.name}
                      </span>
                    </td>
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
                  {detailUserId === rowKey && (
                    <tr className="pay-form-row">
                      <td colSpan={3}>
                        <div className="table-scroll">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'right' }}>Reimbursed</th>
                                <th style={{ textAlign: 'right' }}>Due</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.details.map((d) => (
                                <tr key={d.id}>
                                  <td>{d.displayId || '—'}</td>
                                  <td>{fmtDate(d.date)}</td>
                                  <td>{d.description}</td>
                                  <td className="amt">{fmt(d.amount)}</td>
                                  <td className="amt">{fmt(d.reimbursed)}</td>
                                  <td className="amt">{fmt(d.due)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
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
    </details>
  )
}
