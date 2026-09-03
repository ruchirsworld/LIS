import { useState } from 'react'
import { useExpenseReimbursements } from '../../lib/queries/expenses'
import { useCapitalTx } from '../../lib/queries/capital'
import { useTransfers } from '../../lib/queries/transfers'
import { useWagePayments, useStaffImprestTransactions } from '../../lib/queries/hr'
import { useLoans } from '../../lib/queries/loans'
import { useProfiles } from '../../lib/queries/admin'
import { fmt, fmtDate } from '../../lib/calc/format'

const DEFAULT_THRESHOLD = 50000

interface Flag {
  id: string
  date: string
  type: string
  amount: number
  createdBy: string | null
}

/** Not every transaction in ERP2.0 goes through a review step the way a
 * Supervisor's expense claim does — Capital, Wage payments, Site Imprest,
 * Loans, and Transfers post immediately on entry, by one person, with no
 * counter-signature. Rather than blocking that (impractical with only
 * Admin and CXO as elevated roles — whichever one is working alone that
 * day would be stuck), this surfaces it for periodic review instead: what
 * a real second look should probably cover. */
export function SegregationOfDutiesReport() {
  const { data: reimbursements } = useExpenseReimbursements()
  const { data: capitalTx } = useCapitalTx(null)
  const { data: transfers } = useTransfers(null)
  const { data: wagePayments } = useWagePayments()
  const { data: imprestTx } = useStaffImprestTransactions()
  const { data: loans } = useLoans(null)
  const { data: profiles } = useProfiles()
  const [threshold, setThreshold] = useState(String(DEFAULT_THRESHOLD))

  const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const min = Number(threshold) || 0

  const selfApproved = (reimbursements ?? []).filter((r) => r.approved_by && r.created_by && r.approved_by === r.created_by)

  const highValueFlags: Flag[] = [
    ...(capitalTx ?? [])
      .filter((t) => Number(t.amount) >= min)
      .map((t) => ({ id: t.id, date: t.date ?? '', type: `Capital ${t.type}`, amount: Number(t.amount), createdBy: t.created_by })),
    ...(transfers ?? [])
      .filter((t) => Number(t.amount) >= min)
      .map((t) => ({ id: t.id, date: t.date, type: 'Transfer', amount: Number(t.amount), createdBy: t.created_by })),
    ...(wagePayments ?? [])
      .filter((p) => Number(p.amount) >= min)
      .map((p) => ({ id: p.id, date: p.date, type: 'Wage payment', amount: Number(p.amount), createdBy: p.created_by })),
    ...(imprestTx ?? [])
      .filter((t) => t.kind === 'advance' && Number(t.amount) >= min)
      .map((t) => ({ id: t.id, date: t.date, type: 'Site imprest advance', amount: Number(t.amount), createdBy: t.created_by })),
    ...(loans ?? [])
      .filter((l) => Number(l.principal) >= min)
      .map((l) => ({ id: l.id, date: l.date_taken ?? '', type: `Loan — ${l.lender}`, amount: Number(l.principal), createdBy: l.created_by })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="report-panel">
      <div className="note" style={{ marginBottom: 16 }}>
        Two signals, not a hard block: reimbursements someone approved for themselves, and single-signature
        transactions above a size worth a second look.
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Self-approved reimbursements</h3>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Created &amp; approved by</th>
              </tr>
            </thead>
            <tbody>
              {selfApproved.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    None — every reimbursement on record was approved by someone other than who created it
                  </td>
                </tr>
              )}
              {selfApproved.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.display_id ?? r.reference ?? '—'}</td>
                  <td className="amt">{fmt(r.amount)}</td>
                  <td>{nameOf(r.created_by)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Single-signature transactions above a threshold</h3>
        <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
          Capital, Transfers, Wage payments, Site Imprest advances, and Loans all post immediately on entry — there's
          no review step to check against, so this just lists the larger ones for someone to glance over periodically.
        </div>
        <div className="field" style={{ maxWidth: 200, marginBottom: 12 }}>
          <label>Threshold (₹)</label>
          <input type="number" min="0" step="1000" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Entered by</th>
              </tr>
            </thead>
            <tbody>
              {highValueFlags.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    Nothing above {fmt(min)}
                  </td>
                </tr>
              )}
              {highValueFlags.map((f) => (
                <tr key={`${f.type}-${f.id}`}>
                  <td>{fmtDate(f.date)}</td>
                  <td>{f.type}</td>
                  <td className="amt">{fmt(f.amount)}</td>
                  <td>{nameOf(f.createdBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
