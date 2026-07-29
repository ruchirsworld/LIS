import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useCapitalTx, useDeleteCapitalTx } from '../../lib/queries/capital'
import { usePartners } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
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
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedTx)

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
        <ReportExportButtons title="Capital records" sections={exportSections} range={range} style={{ marginTop: 0 }} />
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
            {pageRows?.map((t) => {
              const partner = partners?.find((p) => p.id === t.partner_id)
              return (
                <tr key={t.id}>
                  <td>{t.display_id ?? '—'}</td>
                  <td>{partner ? partner.name : '—'}</td>
                  <td>{t.type === 'injection' ? 'Injection (in)' : 'Withdrawal (out)'}</td>
                  <td>{t.date ? fmtDate(t.date) : '—'}</td>
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
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
