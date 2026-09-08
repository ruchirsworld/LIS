import { Fragment, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { SearchableSelect } from '../../components/SearchableSelect'
import { TableScroll } from '../../components/TableScroll'
import { PeriodFilter } from '../../components/PeriodFilter'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { useTrips, useUpdateTrip } from '../../lib/queries/trips'
import { useExpenses } from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { DateRange } from '../../lib/calc/period'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Trip = Database['public']['Tables']['trips']['Row']

const COL_SPAN = 9

/** Popup to edit a trip's own details (name/traveler/project/start
 * date/notes) — status/end date stay controlled by the "End Trip" toggle
 * in TripsSection above, not duplicated here. */
function EditTripModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const updateTrip = useUpdateTrip()

  const [name, setName] = useState(trip.name)
  const [travelerId, setTravelerId] = useState(trip.traveler_id)
  const [projectId, setProjectId] = useState(trip.project_id ?? '')
  const [startDate, setStartDate] = useState(trip.start_date)
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
    setSubmitting(true)
    try {
      await updateTrip.mutateAsync({
        id: trip.id,
        patch: {
          name: name.trim(),
          traveler_id: travelerId,
          project_id: projectId || null,
          start_date: startDate,
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
  const { data: trips } = useTrips()
  const { data: expenses } = useExpenses(null)
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange | null>(null)
  const [showPeriodFilter, setShowPeriodFilter] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)

  const travelerName = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')
  const subHeadName = (id: string | null) => (id ? subHeads?.find((s) => s.id === id)?.name ?? '—' : '—')

  const sortedTrips = [...(trips ?? [])]
    .filter((t) => (!range?.from || t.start_date >= range.from) && (!range?.to || t.start_date <= range.to))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  const expensesByTrip = (tripId: string) => (expenses ?? []).filter((e) => e.trip_id === tripId)
  const tripTotal = (tripId: string) => expensesByTrip(tripId).reduce((s, e) => s + Number(e.amount || 0), 0)

  const exportSections: ExportSection[] = [
    {
      title: 'Trip records',
      columns: ['Trip', 'Traveler', 'Project', 'Start', 'End', 'Status', 'Total'],
      rows: sortedTrips.map((t) => [
        t.name,
        travelerName(t.traveler_id),
        projectName(t.project_id),
        fmtDate(t.start_date),
        t.end_date ? fmtDate(t.end_date) : '—',
        t.status,
        tripTotal(t.id),
      ]),
    },
  ]

  return (
    <div className="card" style={{ padding: 16, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>Trip records</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setShowPeriodFilter((v) => !v)}
          >
            Filter by date
          </Button>
          <ReportExportButtons title="Trip records" sections={exportSections} range={range} iconOnly />
        </div>
      </div>
      {showPeriodFilter && <PeriodFilter onChange={setRange} allowCustom />}
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th>Trip</th>
              <th>Traveler</th>
              <th>Project</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedTrips.length === 0 && (
              <tr>
                <td colSpan={COL_SPAN} className="empty-row">
                  No trips recorded yet
                </td>
              </tr>
            )}
            {sortedTrips.map((t) => {
              const isExpanded = expandedId === t.id
              const tripExpenses = expensesByTrip(t.id)
              return (
                <Fragment key={t.id}>
                  <tr onClick={() => setExpandedId(isExpanded ? null : t.id)} style={{ cursor: 'pointer' }}>
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
                    <td>{t.name}</td>
                    <td>{travelerName(t.traveler_id)}</td>
                    <td>{projectName(t.project_id)}</td>
                    <td>{fmtDate(t.start_date)}</td>
                    <td>{t.end_date ? fmtDate(t.end_date) : '—'}</td>
                    <td>{t.status}</td>
                    <td className="amt">{fmt(tripTotal(t.id))}</td>
                    <td>
                      <Button
                        type="button"
                        variant="secondary"
                        className="icon-btn-sq"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTrip(t)
                        }}
                        title="Edit"
                        aria-label="Edit"
                      >
                        ✎
                      </Button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="pay-form-row">
                      <td colSpan={COL_SPAN}>
                        {tripExpenses.length === 0 ? (
                          <div className="note">No entries on this trip.</div>
                        ) : (
                          <table className="data">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Sub-head</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tripExpenses.map((e) => (
                                <tr key={e.id}>
                                  <td>{fmtDate(e.date)}</td>
                                  <td>{e.description}</td>
                                  <td>{subHeadName(e.sub_head_id)}</td>
                                  <td className="amt">{fmt(e.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>

      {editingTrip && <EditTripModal trip={editingTrip} onClose={() => setEditingTrip(null)} />}
    </div>
  )
}
