import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../lib/auth'
import { useTrips, useCreateTrip, useUpdateTrip } from '../../lib/queries/trips'
import { useProfiles } from '../../lib/queries/admin'
import { useProjects } from '../../lib/queries/masters'
import { useExpenses } from '../../lib/queries/expenses'
import { useExpenseSubHeads } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { ReimbursementRecordsTable } from '../expenses/ReimbursementRecordsTable'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { TripRecordsTable } from './TripRecordsTable'
import type { ExportSection } from '../../lib/export/report'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function TripsSection() {
  const { profile } = useAuth()
  const { data: trips } = useTrips()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: expenses } = useExpenses(null)
  const { data: subHeads } = useExpenseSubHeads()
  const createTrip = useCreateTrip()
  const updateTrip = useUpdateTrip()

  const [name, setName] = useState('')
  const [travelerId, setTravelerId] = useState(profile?.id ?? '')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // undefined = user hasn't touched this yet, so default to their own open
  // trip (if any) so it's already showing when they land on the page —
  // null/an id once they've explicitly opened or hidden something.
  const [expandedOverride, setExpandedOverride] = useState<string | null | undefined>(undefined)
  const [showStartTrip, setShowStartTrip] = useState(false)
  // Which date new entries on the expanded trip get logged under — picked
  // here instead of a field inside the Add transaction form below.
  const [entryDate, setEntryDate] = useState(todayStr())

  function resetForm() {
    setName('')
    setTravelerId(profile?.id ?? '')
    setProjectId('')
    setStartDate(todayStr())
    setNotes('')
  }

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
    const travelerOpenTrip = trips?.find((t) => t.traveler_id === travelerId && t.status === 'open')
    if (travelerOpenTrip) {
      const travelerLabel = profiles?.find((p) => p.id === travelerId)?.name ?? 'This traveler'
      setFormError(`${travelerLabel} already has an open trip (${travelerOpenTrip.name}) — close it before starting a new one.`)
      return
    }
    setSubmitting(true)
    try {
      const created = await createTrip.mutateAsync({
        name: name.trim(),
        traveler_id: travelerId,
        project_id: projectId || null,
        cost_center: 'Trips',
        start_date: startDate,
        notes: notes.trim() || null,
      })
      resetForm()
      setExpandedOverride(created.id)
      setShowStartTrip(false)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create trip.'))
    } finally {
      setSubmitting(false)
    }
  }

  function toggleClosed(tripId: string, currentStatus: string) {
    updateTrip.mutate({
      id: tripId,
      patch: { status: currentStatus === 'closed' ? 'open' : 'closed', end_date: currentStatus === 'closed' ? null : todayStr() },
    })
  }

  const subHeadName = (id: string | null) => (id ? subHeads?.find((s) => s.id === id)?.name ?? '—' : '—')

  // Land on the traveler's own open trip automatically so they can start
  // logging spends right away, without hunting for it in the table below.
  const myOpenTrip = trips?.find((t) => t.traveler_id === profile?.id && t.status === 'open')
  const defaultExpandedId = myOpenTrip?.id ?? null
  const expandedId = expandedOverride !== undefined ? expandedOverride : defaultExpandedId

  const expandedTrip = trips?.find((t) => t.id === expandedId) ?? null
  const expandedTripExpenses = expandedTrip ? (expenses ?? []).filter((e) => e.trip_id === expandedTrip.id) : []
  const expandedTripTotal = expandedTripExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  // Reset the entry date back to today whenever a different trip expands —
  // otherwise a date picked for one trip would silently carry over.
  useEffect(() => {
    setEntryDate(todayStr())
  }, [expandedId])

  const tripExportSections: ExportSection[] = expandedTrip
    ? [
        {
          title: `${expandedTrip.name} — entries`,
          columns: ['Date', 'Description', 'Sub-head', 'Amount'],
          rows: expandedTripExpenses.map((e) => [fmtDate(e.date), e.description, subHeadName(e.sub_head_id), e.amount]),
        },
      ]
    : []

  return (
    <div>
      <div className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
        <div className="toolbar" style={{ marginTop: 0, alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>{expandedTrip ? expandedTrip.name : 'No trip in progress'}</strong>
          {expandedTrip ? (
            <div className="toolbar-group" style={{ alignItems: 'center' }}>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                aria-label="Entry date"
                style={{ fontSize: 13, padding: '6px 8px', width: 140 }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  toggleClosed(expandedTrip.id, expandedTrip.status)
                  // Drop the pin on this trip once it's closed — the header
                  // then falls back to "Start trip" instead of lingering on
                  // a trip that's no longer open.
                  setExpandedOverride(undefined)
                }}
              >
                End Trip
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={() => setShowStartTrip(true)}>
              Start trip
            </Button>
          )}
        </div>
      </div>

      {showStartTrip && (
        <Modal title="Start a trip" onClose={() => setShowStartTrip(false)}>
          <form className="form-grid exp-compact" onSubmit={handleSubmit}>
            <div className="field full">
              <label>Trip name / purpose</label>
              <input
                type="text"
                required
                placeholder="e.g. Ujjain site visit"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
            <div className="field full">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Start trip'}
              </Button>
            </div>
          </form>
          {formError && (
            <div className="note" style={{ color: 'var(--red)', marginTop: 8 }}>
              {formError}
            </div>
          )}
        </Modal>
      )}

      {expandedTrip && (
        <>
          <ExpenseForm
            editingExpense={null}
            onDoneEditing={() => {}}
            tripId={expandedTrip.id}
            tripDate={entryDate}
            fixedCostCenter={expandedTrip.cost_center}
            fixedProjectId={expandedTrip.project_id}
          />

          <details className="toggle-section" open>
            <summary>Entries on this trip</summary>
            <div className="toolbar">
              <div className="toolbar-group" />
              <ReportExportButtons
                title={`${expandedTrip.name} entries`}
                sections={tripExportSections}
                range={{ from: expandedTrip.start_date, to: expandedTrip.end_date }}
                iconOnly
                style={{ marginTop: 0 }}
              />
            </div>
            {expandedTripExpenses.length === 0 ? (
              <div className="empty-state">No entries yet — add one above.</div>
            ) : (
              <div className="table-scroll">
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
                    {expandedTripExpenses.map((e) => (
                      <tr key={e.id}>
                        <td>{fmtDate(e.date)}</td>
                        <td>{e.description}</td>
                        <td>{subHeadName(e.sub_head_id)}</td>
                        <td className="amt">{fmt(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ fontWeight: 600 }}>
                        Total
                      </td>
                      <td className="amt" style={{ fontWeight: 600 }}>
                        {fmt(expandedTripTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </details>
        </>
      )}

      {!expandedTrip && !showStartTrip && (
        <div className="empty-state">No trip in progress — tap "Start trip" above to begin one.</div>
      )}

      <TripRecordsTable />
      <ReimbursementRecordsTable costCenter="Trips" />
    </div>
  )
}
