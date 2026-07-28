import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useCapitalTx, useDeleteCapitalTx } from '../../lib/queries/capital'
import { usePartners } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'

export function CapitalTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: tx, isLoading } = useCapitalTx(range)
  const { data: partners } = usePartners()
  const deleteTx = useDeleteCapitalTx()

  return (
    <details className="toggle-section" open>
      <summary>Capital records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Partner</th>
              <th>Type</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!tx || tx.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No capital entries in this period
                </td>
              </tr>
            )}
            {tx?.map((t) => {
              const partner = partners?.find((p) => p.id === t.partner_id)
              return (
                <tr key={t.id}>
                  <td>{t.display_id ?? '—'}</td>
                  <td>{partner ? partner.name : '—'}</td>
                  <td>{t.type === 'injection' ? 'Injection (in)' : 'Withdrawal (out)'}</td>
                  <td>{t.date ?? '—'}</td>
                  <td className="amt">{fmt(t.amount)}</td>
                  <td>{t.notes ?? '—'}</td>
                  <td>
                    <button type="button" className="btn danger-link" onClick={() => deleteTx.mutate(t.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
