import { Fragment, useState } from 'react'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { SettleReimbursementForm } from './SettleReimbursementForm'
import { useReimbursementDue } from './useReimbursementDue'

// A running total, not scoped to the dashboard's period filter — "amount
// still to claim" doesn't stop being owed because it's outside the range.
// Hidden entirely when nothing is due.
export function ReimbursementDue() {
  const dueByUserRows = useReimbursementDue()
  const [settlingUserId, setSettlingUserId] = useState<string>('')
  const [detailUserId, setDetailUserId] = useState<string>('')
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
