import { useState } from 'react'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'
import { TransferForm } from './TransferForm'
import { confirmAction } from '../../lib/feedback'
import type { Database } from '../../types/database'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useTransfers, useDeleteTransfer } from '../../lib/queries/transfers'
import { useBankAccounts } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'

type Transfer = Database['public']['Tables']['transfers']['Row']

export function TransferTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const [search, setSearch] = useState('')
  const openRows = useOpenRows()
  const [editing, setEditing] = useState<Transfer | null>(null)
  const { data: transfers, isLoading } = useTransfers(range)
  const { data: accounts } = useBankAccounts()
  const deleteTransfer = useDeleteTransfer()

  function accountName(id: string | null) {
    if (!id) return 'Cash'
    return accounts?.find((a) => a.id === id)?.name ?? '—'
  }

  async function removeTransfer(t: Transfer) {
    const ok = await confirmAction({
      title: 'Delete transfer',
      message: `Delete transfer ${t.display_id ?? ''} of ${fmt(t.amount)} dated ${t.date ? fmtDate(t.date) : ''}? The money goes back to where it was. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteTransfer.mutate(t.id)
  }

  const searchedTransfers = search
    ? transfers?.filter((t) => matchesSearch(search, [t.display_id, t.notes, t.date, t.amount, accountName(t.from_account_id), accountName(t.to_account_id)]))
    : transfers

  const { sorted: sortedTransfers, sortKey, direction, toggleSort } = useSort(
    searchedTransfers,
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
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedTransfers, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Transfer records',
      columns: ['ID', 'From', 'To', 'Date', 'Amount', 'Notes'],
      rows: (sortedTransfers ?? []).map((t) => [
        t.display_id ?? '',
        accountName(t.from_account_id),
        accountName(t.to_account_id),
        t.date ? fmtDate(t.date) : '',
        t.amount,
        t.notes ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Transfer records</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle range={range} onChange={setRange} />
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Transfer records" sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
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
                <td colSpan={8} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedTransfers || sortedTransfers.length === 0) && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No transfers in this period
                </td>
              </tr>
            )}
            {pageRows?.map((t) => (
              <RecordRow
                key={t.id}
                expanded={openRows.isOpen(t.id)}
                onToggle={() => openRows.toggle(t.id)}
                colSpan={8}
                details={<RecordDetails sourceTable="transfers" sourceId={t.id} />}
                onEdit={() => setEditing(t)}
                onDelete={() => void removeTransfer(t)}
              >
                <td>{t.display_id ?? '—'}</td>
                <td>{accountName(t.from_account_id)}</td>
                <td>{accountName(t.to_account_id)}</td>
                <td>{t.date ? fmtDate(t.date) : '—'}</td>
                <td className="amt">{fmt(t.amount)}</td>
                <td>{t.notes ?? '—'}</td>
              </RecordRow>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editing && (
        <Modal title={`Edit transfer ${editing.display_id ?? ''}`} onClose={() => setEditing(null)}>
          <TransferForm editing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </details>
  )
}
