import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { useSort } from '../../lib/useSort'
import { useCapitalTx, useDeleteCapitalTx } from '../../lib/queries/capital'
import { usePartners } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'

export function CapitalTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: tx, isLoading } = useCapitalTx(range)
  const { data: partners } = usePartners()
  const deleteTx = useDeleteCapitalTx()

  const partnerNameOf = (t: NonNullable<typeof tx>[number]) => partners?.find((p) => p.id === t.partner_id)?.name ?? ''

  const { sorted: sortedTx, sortKey, direction, toggleSort } = useSort(
    tx,
    {
      id: (t) => t.display_id,
      partner: (t) => partnerNameOf(t),
      type: (t) => t.type,
      date: (t) => t.date,
      amount: (t) => t.amount,
      notes: (t) => t.notes,
    },
    'date'
  )

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
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Partner" sortKey="partner" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Notes" sortKey="notes" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
            {!isLoading && (!sortedTx || sortedTx.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No capital entries in this period
                </td>
              </tr>
            )}
            {sortedTx?.map((t) => {
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
