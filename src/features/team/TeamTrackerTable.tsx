import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useTeamTracker, useDeleteTeamTracker, useTeamTrackerPayments } from '../../lib/queries/team'
import { useProjects } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
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

  const projectNameOf = (t: NonNullable<typeof entries>[number]) => projects?.find((p) => p.id === t.project_id)?.name ?? ''
  const paidOf = (t: NonNullable<typeof entries>[number]) => ttPaid(payments?.filter((p) => p.team_tracker_id === t.id) ?? [])
  const dueOf = (t: NonNullable<typeof entries>[number]) => ttDue(t.total, payments?.filter((p) => p.team_tracker_id === t.id) ?? [])

  const { sorted: sortedEntries, sortKey, direction, toggleSort } = useSort(
    entries,
    {
      id: (t) => t.display_id,
      date: (t) => t.date,
      supplier: (t) => t.supplier,
      project: (t) => projectNameOf(t),
      qty: (t) => t.qty,
      rate: (t) => t.rate,
      total: (t) => t.total,
      paid: (t) => paidOf(t),
      due: (t) => dueOf(t),
      remarks: (t) => t.remarks,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedEntries)

  const exportSections: ExportSection[] = [
    {
      title: 'Team tracker records',
      columns: ['ID', 'Date', 'Supplier', 'Project', 'Qty', 'Rate', 'Total', 'Paid', 'Due', 'Remarks'],
      rows: (sortedEntries ?? []).map((t) => [
        t.display_id ?? '',
        fmtDate(t.date),
        t.supplier,
        projectNameOf(t),
        t.qty ?? '',
        t.rate ?? '',
        t.total ?? '',
        paidOf(t),
        dueOf(t),
        t.remarks ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Team tracker records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} allowCustom />
      </div>

      <ReportExportButtons title="Team tracker records" sections={exportSections} range={range} />

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Supplier" sortKey="supplier" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Qty" sortKey="qty" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Rate" sortKey="rate" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Total" sortKey="total" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Remarks" sortKey="remarks" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
            {pageRows?.map((t) => {
              const proj = projects?.find((p) => p.id === t.project_id)
              const entryPayments = payments?.filter((p) => p.team_tracker_id === t.id) ?? []
              const paid = ttPaid(entryPayments)
              const due = ttDue(t.total, entryPayments)
              const historyHtml = entryPayments.length > 0

              return (
                <Fragment key={t.id}>
                  <tr>
                    <td>{t.display_id ?? '—'}</td>
                    <td>{fmtDate(t.date)}</td>
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
                              {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
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
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
