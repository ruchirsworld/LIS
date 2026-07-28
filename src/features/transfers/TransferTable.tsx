import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useTransfers, useDeleteTransfer } from '../../lib/queries/transfers'
import { useBankAccounts } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'

export function TransferTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: transfers, isLoading } = useTransfers(range)
  const { data: accounts } = useBankAccounts()
  const deleteTransfer = useDeleteTransfer()

  function accountName(id: string | null) {
    if (!id) return 'Cash'
    return accounts?.find((a) => a.id === id)?.name ?? '—'
  }

  return (
    <details className="toggle-section" open>
      <summary>Transfer records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>From</th>
              <th>To</th>
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
            {!isLoading && (!transfers || transfers.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No transfers in this period
                </td>
              </tr>
            )}
            {transfers?.map((t) => (
              <tr key={t.id}>
                <td>{t.display_id ?? '—'}</td>
                <td>{accountName(t.from_account_id)}</td>
                <td>{accountName(t.to_account_id)}</td>
                <td>{t.date ?? '—'}</td>
                <td className="amt">{fmt(t.amount)}</td>
                <td>{t.notes ?? '—'}</td>
                <td>
                  <button type="button" className="btn danger-link" onClick={() => deleteTransfer.mutate(t.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
