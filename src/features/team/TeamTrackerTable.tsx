import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useTeamTracker, useDeleteTeamTracker, useTeamTrackerPayments } from '../../lib/queries/team'
import { useProjects } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import { ttPaid, ttDue } from '../../lib/calc/teamTracker'
import type { DateRange } from '../../lib/calc/period'
import { TeamTrackerPaymentForm } from './TeamTrackerPaymentForm'
import { useAuth } from '../../lib/auth'

export function TeamTrackerTable() {
  const { profile } = useAuth()
  const canWrite = profile?.role === 'admin' || profile?.role === 'cxo'
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: entries, isLoading } = useTeamTracker(range)
  const { data: projects } = useProjects()
  const { data: payments } = useTeamTrackerPayments()
  const deleteEntry = useDeleteTeamTracker()
  const [payFormId, setPayFormId] = useState<string | null>(null)

  return (
    <details className="toggle-section" open>
      <summary>Team tracker records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Project</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              <th>Remarks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!entries || entries.length === 0) && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No team tracker entries in this period
                </td>
              </tr>
            )}
            {entries?.map((t) => {
              const proj = projects?.find((p) => p.id === t.project_id)
              const entryPayments = payments?.filter((p) => p.team_tracker_id === t.id) ?? []
              const paid = ttPaid(entryPayments)
              const due = ttDue(t.total, entryPayments)
              const historyHtml = entryPayments.length > 0

              return (
                <Fragment key={t.id}>
                  <tr>
                    <td>{t.display_id ?? '—'}</td>
                    <td>{t.date}</td>
                    <td>{t.supplier}</td>
                    <td>{proj ? proj.name : '—'}</td>
                    <td className="amt">{t.qty ?? '—'}</td>
                    <td className="amt">{t.rate ? fmt(t.rate) : '—'}</td>
                    <td className="amt">{t.total ? fmt(t.total) : '—'}</td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{fmt(due)}</td>
                    <td>{t.remarks ?? '—'}</td>
                    <td>
                      {canWrite && due > 0 && (
                        <button type="button" className="pay-btn" onClick={() => setPayFormId(t.id)}>
                          Record payment
                        </button>
                      )}
                      {canWrite && (
                        <button type="button" className="btn danger-link" onClick={() => deleteEntry.mutate(t.id)}>
                          Remove
                        </button>
                      )}
                      {historyHtml && (
                        <div className="pay-history">
                          {entryPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {p.date} — {fmt(p.amount)}
                              {p.reference ? ` · ${p.reference}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {payFormId === t.id && (
                    <TeamTrackerPaymentForm teamTrackerId={t.id} due={due} onClose={() => setPayFormId(null)} />
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
