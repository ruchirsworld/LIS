import { activateProps } from '../../lib/a11y'
import { confirmAction } from '../../lib/feedback'
import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { RowMenu } from '../../components/RowMenu'
import { Modal } from '../../components/Modal'
import { SearchableSelect } from '../../components/SearchableSelect'
import { TableScroll } from '../../components/TableScroll'
import { Pagination } from '../../components/Pagination'
import { SortableTh } from '../../components/SortableTh'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { useTrips, useUpdateTrip, useDeleteTrip } from '../../lib/queries/trips'
import { useExpenses, useDeleteExpense } from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useBankAccounts, useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { SpendBySource } from './SpendBySource'
import { RecordDetailModal } from '../reports/RecordDetailModal'
import { spendExportSection } from '../../lib/calc/spendByAccount'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import type { DateRange } from '../../lib/calc/period'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Trip = Database['public']['Tables']['trips']['Row']
type ExpenseRow = Database['public']['Tables']['expenses']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const COL_SPAN = 8

const DAY_MS = 86400000
/** Days a trip took, counting both its first and last day; an open trip counts up to today. */
function tripDays(start: string, end: string | null): number {
  const to = end ?? new Date().toISOString().slice(0, 10)
  const days = Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10))) / DAY_MS) + 1
  return Math.max(1, days)
}

/** The month a trip belongs to: the one it started in. */
const monthOf = (date: string) => date.slice(0, 7)
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

/** Popup to edit a trip's own details, including its dates — status itself
 * (open/closed) still stays controlled by the "End Trip" toggle in
 * TripsSection above, not duplicated here; this only edits the end date's
 * value for whatever status the trip is already in. */
function EditTripModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const updateTrip = useUpdateTrip()

  const [name, setName] = useState(trip.name)
  const [travelerId, setTravelerId] = useState(trip.traveler_id)
  const [projectId, setProjectId] = useState(trip.project_id ?? '')
  const [startDate, setStartDate] = useState(trip.start_date)
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  const [notes, setNotes] = useState(trip.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Give the trip a name or purpose.')
      return
    }
    if (!travelerId) {
      setFormError('Pick who is traveling.')
      return
    }
    if (endDate && endDate < startDate) {
      setFormError('End date can\'t be before the start date.')
      return
    }
    setSubmitting(true)
    try {
      await updateTrip.mutateAsync({
        id: trip.id,
        patch: {
          name: name.trim(),
          traveler_id: travelerId,
          project_id: projectId || null,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim() || null,
        },
      })
      onClose()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save changes.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Edit trip" onClose={onClose}>
      <form className="form-grid exp-compact" onSubmit={handleSubmit}>
        <div className="field full">
          <label>Trip name / purpose</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Traveler</label>
          <SearchableSelect
            items={profiles}
            value={travelerId}
            onChange={setTravelerId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select traveler —"
          />
        </div>
        <div className="field">
          <label>Project (optional)</label>
          <SearchableSelect
            items={projects}
            value={projectId}
            onChange={setProjectId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— No specific project —"
          />
        </div>
        <div className="field">
          <label>Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>End date{trip.status === 'open' ? ' (optional)' : ''}</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field full">
          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: 8 }}>
          {formError}
        </div>
      )}
    </Modal>
  )
}

/** Every trip (open or closed), grouped — one row per trip with its total,
 * expandable to the entries logged on it. TripsSection above only ever
 * shows the traveler's own currently-open trip, so this is the only place
 * to browse past trips or see someone else's. */
export function TripRecordsTable() {
  const { profile } = useAuth()
  // Deleting un-does the trip entirely (and fails outright if it still has
  // expenses logged against it, via the plain FK) — a heavier action than
  // editing, so it's Admin-only, matching the same precedent used for
  // Imprest transactions.
  const canDelete = profile?.role === 'admin'
  const { data: trips } = useTrips()
  const { data: expenses } = useExpenses(null)
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: banks } = useBankAccounts()
  const deleteTrip = useDeleteTrip()
  const deleteExpense = useDeleteExpense()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  // The trip's own details (traveler, project, dates, who recorded it) are in the row's menu; the arrow shows its entries.
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [entryDate, setEntryDate] = useState(todayStr())
  // Trips are clustered under a heading for the month they started in; a heading folds its trips away.
  const [groupByMonth, setGroupByMonth] = useState(true)
  const [search, setSearch] = useState('')
  // Every month starts folded; the ones the person opens are remembered here.
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  function toggleMonth(month: string) {
    setOpenMonths((cur) => {
      const next = new Set(cur)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  // Reset the add-expense panel and its date whenever a different trip
  // expands — otherwise a date picked for one trip would carry over to
  // the next, and a stale form would stay open.
  useEffect(() => {
    setShowAddExpense(false)
    const trip = trips?.find((t) => t.id === expandedId)
    setEntryDate(trip ? trip.end_date ?? trip.start_date : todayStr())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId])

  async function handleDeleteExpense(e: ExpenseRow) {
    const ok = await confirmAction({
      title: 'Delete entry',
      message: `Delete this entry of ${fmt(e.amount)} dated ${fmtDate(e.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteExpense.mutate(e.id)
  }

  async function handleDeleteTrip(t: Trip) {
    const ok = await confirmAction({
      title: 'Delete trip',
      message: `Delete trip "${t.name}"? This cannot be undone, and will fail if any expenses are still logged against it.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setDeleteBusyId(t.id)
    setDeleteError((m) => ({ ...m, [t.id]: '' }))
    try {
      await deleteTrip.mutateAsync(t.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDeleteError((m) => ({
        ...m,
        [t.id]:
          message.includes('foreign key constraint') || message.includes('violates')
            ? 'Cannot delete this trip — it still has entries logged against it. Remove those entries first (expand the trip below), then delete it.'
            : getErrorMessage(err, 'Could not delete this trip.'),
      }))
    } finally {
      setDeleteBusyId(null)
    }
  }

  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')
  const locationOf = (t: Trip) => (t.project_id ? projects?.find((p) => p.id === t.project_id)?.project_location ?? '' : '')
  // Who travelled: the person named on the trip, and anyone else who logged an entry on it.
  const travellersOf = (t: Trip): string[] => {
    const ids = [t.traveler_id, ...(expenses ?? []).filter((e) => e.trip_id === t.id).map((e) => e.created_by)]
    return [...new Set(ids.filter((id): id is string => !!id))].map((id) => profiles?.find((p) => p.id === id)?.name ?? '—')
  }
  const subHeadName = (id: string | null) => (id ? subHeads?.find((s) => s.id === id)?.name ?? '—' : '—')

  const expensesByTrip = (tripId: string) => (expenses ?? []).filter((e) => e.trip_id === tripId)
  const tripTotal = (tripId: string) => expensesByTrip(tripId).reduce((s, e) => s + Number(e.amount || 0), 0)

  // The search also looks inside a trip, so a trip can be found by any entry logged on it.
  const rangeFilteredTrips = (trips ?? []).filter(
    (t) =>
      (!range?.from || t.start_date >= range.from) &&
      (!range?.to || t.start_date <= range.to) &&
      (!search ||
        matchesSearch(search, [
          t.display_id,
          t.name,
          t.notes,
          t.status,
          t.start_date,
          t.end_date,
          locationOf(t),
          ...travellersOf(t),
          projectName(t.project_id),
          ...expensesByTrip(t.id).flatMap((e) => [e.display_id, e.description, e.remarks, e.amount]),
        ]))
  )
  // Everything spent on the trips shown, for the summary by account.
  const shownTripIds = new Set(rangeFilteredTrips.map((t) => t.id))
  const shownExpenses = (expenses ?? []).filter((e) => e.trip_id && shownTripIds.has(e.trip_id))
  const { sorted, sortKey, direction, toggleSort } = useSort(
    rangeFilteredTrips,
    {
      id: (t) => t.display_id,
      location: (t) => locationOf(t),
      name: (t) => t.name,
      traveler: (t) => travellersOf(t).join(', '),
      start: (t) => t.start_date,
      total: (t) => tripTotal(t.id),
    },
    'start',
    'desc'
  )
  const sortedByColumn = sorted ?? []
  // Grouped: months run newest first (oldest first when sorting by an ascending start date), and the chosen
  // sort applies to the trips inside each month.
  const monthsInOrder = [...new Set(sortedByColumn.map((t) => monthOf(t.start_date)))].sort((a, b) =>
    sortKey === 'start' && direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  )
  const sortedTrips = groupByMonth ? monthsInOrder.flatMap((m) => sortedByColumn.filter((t) => monthOf(t.start_date) === m)) : sortedByColumn
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedTrips, search)
  // A month's figures cover all of its trips, not only the ones on this page.
  const monthSummary = (month: string) => {
    const tripsInMonth = sortedTrips.filter((t) => monthOf(t.start_date) === month)
    const ids = new Set(tripsInMonth.map((t) => t.id))
    const spent = (expenses ?? []).filter((e) => e.trip_id && ids.has(e.trip_id))
    return { count: tripsInMonth.length, spent, total: spent.reduce((s, e) => s + Number(e.amount || 0), 0) }
  }

  // A month is folded unless it was opened, except while searching, when every month shows what matched.
  const isMonthFolded = (month: string) => groupByMonth && !search && !openMonths.has(month)
  // Every other visible trip is shaded, so the rows are easy to follow across the table.
  const shadedTrips = new Map<string, boolean>()
  let shown = 0
  for (const t of pageRows ?? []) {
    if (isMonthFolded(monthOf(t.start_date))) continue
    shadedTrips.set(t.id, shown % 2 === 1)
    shown += 1
  }

  const exportSections: ExportSection[] = [
    {
      title: 'Trip records',
      columns: ['ID', 'Location', 'Purpose', 'Project', 'From', 'To', 'Days', 'Travellers', 'Status', 'Total'],
      rows: sortedTrips.map((t) => [
        t.display_id ?? '',
        locationOf(t),
        t.name,
        projectName(t.project_id),
        fmtDate(t.start_date),
        t.end_date ? fmtDate(t.end_date) : '—',
        tripDays(t.start_date, t.end_date),
        travellersOf(t).join(', '),
        t.status,
        tripTotal(t.id),
      ]),
    },
    spendExportSection('Spent via', shownExpenses, banks ?? []),
  ]

  return (
    <details className="toggle-section" open>
      <summary>Trip records</summary>

      <div className="toolbar">
        <div className="toolbar-group">
          <PeriodFilterToggle range={range} onChange={setRange} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={groupByMonth} onChange={(e) => setGroupByMonth(e.target.checked)} />
            Group trips within months
          </label>
        </div>
        <ReportExportButtons title="Trip records" sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
      </div>

      <SpendBySource expenses={shownExpenses} label="All trips shown, spent via" />
      <TableSearch value={search} onChange={setSearch} placeholder="Search trips by ID, location, purpose, traveller, project or any entry on them…" />

      <TableScroll>
        <table
          className="data table-compact"
          ref={(el) => {
            if (el) el.style.setProperty('--thead-h', `${el.tHead?.offsetHeight ?? 28}px`)
          }}
        >
          <thead>
            <tr>
              <th></th>
              <SortableTh label="Trip ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Location" sortKey="location" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Purpose" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Dates (days)" sortKey="start" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Traveller" sortKey="traveler" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="total" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
            </tr>
          </thead>
            {sortedTrips.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={COL_SPAN} className="empty-row">
                    No trips in this period
                  </td>
                </tr>
              </tbody>
            )}
            {pageRows?.map((t, idx) => {
              const isExpanded = expandedId === t.id
              const tripExpenses = expensesByTrip(t.id)
              const month = monthOf(t.start_date)
              const isNewMonth = groupByMonth && (idx === 0 || monthOf(pageRows[idx - 1].start_date) !== month)
              const monthCollapsed = isMonthFolded(month)
              const summary = isNewMonth ? monthSummary(month) : null
              return (
                <Fragment key={t.id}>
                  {summary && (
                    <tbody>
                    <tr className="group-header-row" onClick={() => toggleMonth(month)} style={{ cursor: 'pointer' }}>
                      <td colSpan={COL_SPAN} style={{ fontSize: 14, padding: '10px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                            <span style={{ display: 'inline-block', width: 16, fontSize: 12, opacity: 0.6 }}>{monthCollapsed ? '▸' : '▾'}</span>
                            {monthLabel(month)}
                          </span>
                          <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                            {summary.count} trip{summary.count === 1 ? '' : 's'} · {fmt(summary.total)}
                          </span>
                        </div>
                        {!monthCollapsed && <SpendBySource expenses={summary.spent} label="Spent via" style={{ margin: '6px 0 0', fontWeight: 400 }} />}
                      </td>
                    </tr>
                    </tbody>
                  )}
                  {!monthCollapsed && (
                  <tbody
                    className="trip-block"
                    ref={(el) => {
                      // The trip row and the entries heading stay in view while its entries scroll: the heading sticks below the row.
                      if (el) el.style.setProperty('--trip-h', `${el.querySelector<HTMLElement>('tr.trip-main')?.offsetHeight ?? 0}px`)
                    }}
                  >
                  <tr className={`trip-main${shadedTrips.get(t.id) ? ' row-alt' : ''}`} {...activateProps(() => setExpandedId(isExpanded ? null : t.id))} style={{ cursor: 'pointer' }}>
                    <td>
                      <button
                        type="button"
                        className="row-expand-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedId(isExpanded ? null : t.id)
                        }}
                        aria-label={isExpanded ? 'Hide entries' : 'Show entries'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td>
                      {t.display_id ?? '—'}
                      {t.status === 'open' && <div className="retention-note">open</div>}
                    </td>
                    <td>{locationOf(t) || '—'}</td>
                    <td>
                      {t.name}
                      {t.project_id && <div className="retention-note">{projectName(t.project_id)}</div>}
                    </td>
                    <td>
                      {fmtDate(t.start_date)} – {t.end_date ? fmtDate(t.end_date) : 'ongoing'}
                      <div className="retention-note">
                        {tripDays(t.start_date, t.end_date)} day{tripDays(t.start_date, t.end_date) === 1 ? '' : 's'}
                        {t.end_date ? '' : ' so far'}
                      </div>
                    </td>
                    <td>
                      {travellersOf(t).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </td>
                    <td className="amt">{fmt(tripTotal(t.id))}</td>
                    <td style={{ width: 40, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        items={[
                          { label: 'Details', onClick: () => setViewingTrip(t) },
                          { label: 'Edit', onClick: () => setEditingTrip(t) },
                          ...(canDelete ? [{ label: 'Delete', disabled: deleteBusyId === t.id, onClick: () => void handleDeleteTrip(t) }] : []),
                        ]}
                      />
                      {deleteError[t.id] && (
                        <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                          {deleteError[t.id]}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="pay-form-row">
                      <td colSpan={COL_SPAN}>
                        {/* One slim heading: the title, what was spent from where, and the button to add an entry. */}
                        <div className="trip-entries-head" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 18px', marginBottom: 10 }}>
                          <strong style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Entries on this trip</strong>
                          <SpendBySource compact expenses={tripExpenses} label="Spent via" style={{ flex: 1, minWidth: 220 }} />
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {showAddExpense && (
                              <input
                                type="date"
                                value={entryDate}
                                onChange={(ev) => setEntryDate(ev.target.value)}
                                style={{ fontSize: 12, padding: '4px 6px', width: 130 }}
                              />
                            )}
                            <Button
                              type="button"
                              variant={showAddExpense ? 'secondary' : 'primary'}
                              style={{ fontSize: 12, padding: '6px 14px', fontWeight: 600 }}
                              onClick={() => setShowAddExpense((v) => !v)}
                            >
                              {showAddExpense ? 'Close' : '+ Add expense'}
                            </Button>
                          </div>
                        </div>
                        {showAddExpense && (
                          <div style={{ marginBottom: 12 }}>
                            <ExpenseForm
                              editingExpense={null}
                              onDoneEditing={() => {}}
                              tripId={t.id}
                              tripDate={entryDate}
                              fixedCostCenter={t.cost_center}
                              fixedProjectId={t.project_id}
                            />
                          </div>
                        )}
                        {tripExpenses.length === 0 ? (
                          <div className="empty-state">No entries on this trip.</div>
                        ) : (
                          <>
                          <table className="data entry-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Sub-head</th>
                                <th>Remarks</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {tripExpenses.map((e) => (
                                <Fragment key={e.id}>
                                  <tr className={e.reimbursable ? 'row-reimb' : undefined} title={e.reimbursable ? 'Recorded as reimbursement' : undefined}>
                                    <td>{fmtDate(e.date)}</td>
                                    <td>{e.description}</td>
                                    <td>{subHeadName(e.sub_head_id)}</td>
                                    <td>{e.remarks || '—'}</td>
                                    <td className="amt">{fmt(e.amount)}</td>
                                    <td style={{ width: 40, textAlign: 'right' }}>
                                      <RowMenu
                                        items={[
                                          { label: 'Edit', onClick: () => setEditingExpenseId(e.id) },
                                          ...(canDelete ? [{ label: 'Delete', onClick: () => void handleDeleteExpense(e) }] : []),
                                        ]}
                                      />
                                    </td>
                                  </tr>
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  </tbody>
                  )}
                </Fragment>
              )
            })}
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editingTrip && <EditTripModal trip={editingTrip} onClose={() => setEditingTrip(null)} />}
      {viewingTrip && (
        <RecordDetailModal
          title={`Trip ${viewingTrip.display_id ?? ''}`}
          sourceTable="trips"
          sourceId={viewingTrip.id}
          onClose={() => setViewingTrip(null)}
          onOpenScreen={() => {
            const trip = viewingTrip
            setViewingTrip(null)
            setEditingTrip(trip)
          }}
        />
      )}
      {editingExpenseId && (expenses ?? []).find((x) => x.id === editingExpenseId) && (
        <Modal title="Edit entry" onClose={() => setEditingExpenseId(null)}>
          <ExpenseForm editingExpense={(expenses ?? []).find((x) => x.id === editingExpenseId) ?? null} onDoneEditing={() => setEditingExpenseId(null)} />
        </Modal>
      )}
    </details>
  )
}
