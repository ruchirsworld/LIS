import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { useExpenses } from '../../lib/queries/expenses'
import { useTrips } from '../../lib/queries/trips'
import { useProjects } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'

// Trip entries always carry cost_center "Trips" (never "Project"), so they
// never show up in the plain Project-cost-center list above even when
// they're tagged to a project — this is a separate, read-only view of that
// overlap. Editing/deleting these stays under Trips, where the rest of that
// trip's lifecycle (dates, other entries) lives.
export function TripLinkedProjectExpenses() {
  const { data: expenses } = useExpenses(null)
  const { data: trips } = useTrips()
  const { data: projects } = useProjects()

  const rows = (expenses ?? []).filter((e) => e.cost_center === 'Trips' && e.project_id)

  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')
  const tripName = (id: string | null) => (id ? trips?.find((t) => t.id === id)?.name ?? '—' : '—')

  const { sorted, sortKey, direction, toggleSort } = useSort(
    rows,
    {
      date: (e) => e.date,
      project: (e) => projectName(e.project_id),
      trip: (e) => tripName(e.trip_id),
      description: (e) => e.description,
      amount: (e) => e.amount,
    },
    'date',
    'desc'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sorted)

  if (rows.length === 0) return null

  return (
    <details className="toggle-section" style={{ marginTop: 16 }}>
      <summary>Trip-linked project expenses ({rows.length})</summary>
      <div className="note" style={{ marginTop: 16, marginBottom: 12 }}>
        Logged under a trip, not here — shown for reference since they still count toward these projects' totals on
        Project Overview. Edit or delete them from Trips.
      </div>
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Trip" sortKey="trip" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {pageRows?.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.date)}</td>
                <td>{projectName(e.project_id)}</td>
                <td>{tripName(e.trip_id)}</td>
                <td>{e.description ?? '—'}</td>
                <td className="amt">{fmt(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
