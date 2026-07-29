import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { useTransfers, useDeleteTransfer } from '../../lib/queries/transfers'
import { useBankAccounts } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
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

  const { sorted: sortedTransfers, sortKey, direction, toggleSort } = useSort(
    transfers,
    {
      id: (t) => t.display_id,
      from: (t) => accountName(t.from_account_id),
      to: (t) => accountName(t.to_account_id),
      date: (t) => t.date,
      amount: (t) => t.amount,
      notes: (t) => t.notes,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedTransfers)

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
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="From" sortKey="from" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="To" sortKey="to" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
            {!isLoading && (!sortedTransfers || sortedTransfers.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No transfers in this period
                </td>
              </tr>
            )}
            {pageRows?.map((t) => (
              <tr key={t.id}>
                <td>{t.display_id ?? '—'}</td>
                <td>{accountName(t.from_account_id)}</td>
                <td>{accountName(t.to_account_id)}</td>
                <td>{t.date ? fmtDate(t.date) : '—'}</td>
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
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
