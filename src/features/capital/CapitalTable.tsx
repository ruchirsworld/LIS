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
import { CapitalForm } from './CapitalForm'
import { confirmAction } from '../../lib/feedback'
import type { Database } from '../../types/database'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useCapitalTx, useDeleteCapitalTx } from '../../lib/queries/capital'
import { useProfiles } from '../../lib/queries/admin'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'

type CapitalTx = Database['public']['Tables']['capital_transactions']['Row']

export function CapitalTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const [search, setSearch] = useState('')
  const openRows = useOpenRows()
  const [editing, setEditing] = useState<CapitalTx | null>(null)
  const { data: tx, isLoading } = useCapitalTx(range)
  const { data: profiles } = useProfiles()
  const deleteTx = useDeleteCapitalTx()

  const partnerNameOf = (t: NonNullable<typeof tx>[number]) => profiles?.find((p) => p.id === t.partner_id)?.name ?? ''

  async function removeTx(t: CapitalTx) {
    const ok = await confirmAction({
      title: 'Delete capital entry',
      message: `Delete ${t.display_id ?? 'this entry'} of ${fmt(t.amount)} dated ${t.date ? fmtDate(t.date) : ''}? It moves to the Trash and can be restored.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteTx.mutate(t.id)
  }

  const searchedTx = search
    ? tx?.filter((t) => matchesSearch(search, [t.display_id, t.notes, t.date, t.amount, t.type === 'injection' ? 'capital put in injection' : 'capital withdrawn withdrawal', t.payment_mode, partnerNameOf(t)]))
    : tx

  const { sorted: sortedTx, sortKey, direction, toggleSort } = useSort(
    searchedTx,
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
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedTx, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Capital records',
      columns: ['ID', 'Partner', 'Type', 'Date', 'Amount', 'Notes'],
      rows: (sortedTx ?? []).map((t) => [
        t.display_id ?? '',
        partnerNameOf(t),
        t.type === 'injection' ? 'Injection (in)' : 'Withdrawal (out)',
        t.date ? fmtDate(t.date) : '',
        t.amount,
        t.notes ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Capital records</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle range={range} onChange={setRange} />
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Capital records" sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
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
                <td colSpan={8} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedTx || sortedTx.length === 0) && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No capital entries in this period
                </td>
              </tr>
            )}
            {pageRows?.map((t) => {
              const partner = profiles?.find((p) => p.id === t.partner_id)
              return (
                <RecordRow
                  key={t.id}
                  expanded={openRows.isOpen(t.id)}
                  onToggle={() => openRows.toggle(t.id)}
                  colSpan={8}
                  details={<RecordDetails sourceTable="capital_transactions" sourceId={t.id} />}
                  onEdit={() => setEditing(t)}
                  onDelete={() => void removeTx(t)}
                >
                  <td>{t.display_id ?? '—'}</td>
                  <td>{partner ? partner.name : '—'}</td>
                  <td>{t.type === 'injection' ? 'Injection (in)' : 'Withdrawal (out)'}</td>
                  <td>{t.date ? fmtDate(t.date) : '—'}</td>
                  <td className="amt">{fmt(t.amount)}</td>
                  <td>{t.notes ?? '—'}</td>
                </RecordRow>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editing && (
        <Modal title={`Edit capital entry ${editing.display_id ?? ''}`} onClose={() => setEditing(null)}>
          <CapitalForm editing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </details>
  )
}
