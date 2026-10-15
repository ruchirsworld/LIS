import { useTrips, useUpdateTrip, useDeleteTrip } from '../../lib/queries/trips'
import { useProfiles } from '../../lib/queries/admin'
import { useProjects } from '../../lib/queries/masters'
import { useExpenses } from '../../lib/queries/expenses'
import { useBankAccounts } from '../../lib/queries/masters'
import { SpendBySource, spendExportSection } from '../trips/SpendBySource'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function TripsReport({ range }: { range: DateRange | null }) {
  const { data: trips, isLoading } = useTrips()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: expenses } = useExpenses(null)
  const { data: banks } = useBankAccounts()
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()

  const travelerName = (id: string) => profiles?.find((p) => p.id === id)?.name ?? '—'
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')

  const rangedTrips = (trips ?? []).filter((t) => {
    if (range?.from && t.start_date < range.from) return false
    if (range?.to && t.start_date > range.to) return false
    return true
  })

  function toggleClosed(tripId: string, currentStatus: string) {
    updateTrip.mutate({
      id: tripId,
      patch: { status: currentStatus === 'closed' ? 'open' : 'closed', end_date: currentStatus === 'closed' ? null : todayStr() },
    })
  }

  const rangedTripIds = new Set(rangedTrips.map((t) => t.id))
  const rangedExpenses = (expenses ?? []).filter((e) => e.trip_id && rangedTripIds.has(e.trip_id))

  const sections: ExportSection[] = [
    {
      title: 'Trips',
      columns: ['ID', 'Name', 'Traveler', 'Cost center', 'Project', 'Start', 'End', 'Status', 'Total spent'],
      rows: rangedTrips.map((trip) => {
        const total = (expenses ?? []).filter((e) => e.trip_id === trip.id).reduce((s, e) => s + Number(e.amount || 0), 0)
        return [
          trip.display_id ?? '',
          trip.name,
          travelerName(trip.traveler_id),
          trip.cost_center ?? '',
          projectName(trip.project_id),
          fmtDate(trip.start_date),
          trip.end_date ? fmtDate(trip.end_date) : 'ongoing',
          trip.status,
          total,
        ]
      }),
    },
    spendExportSection('Spent via', rangedExpenses, banks ?? []),
  ]

  return (
    <div className="report-panel">
      <ReportExportButtons title="Trips" sections={sections} range={range} />
      <SpendBySource expenses={rangedExpenses} label="All trips shown, spent via" />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Traveler</th>
              <th>Cost center</th>
              <th>Project</th>
              <th>Dates</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total spent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rangedTrips.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No trips in this period
                </td>
              </tr>
            )}
            {rangedTrips.map((trip) => {
              const total = (expenses ?? []).filter((e) => e.trip_id === trip.id).reduce((s, e) => s + Number(e.amount || 0), 0)
              return (
                <tr key={trip.id}>
                  <td>{trip.display_id ?? '—'}</td>
                  <td>{trip.name}</td>
                  <td>{travelerName(trip.traveler_id)}</td>
                  <td>{trip.cost_center ?? '—'}</td>
                  <td>{projectName(trip.project_id)}</td>
                  <td>
                    {fmtDate(trip.start_date)}
                    {trip.end_date ? ` – ${fmtDate(trip.end_date)}` : ' – ongoing'}
                  </td>
                  <td>
                    <span className={`badge ${trip.status === 'closed' ? 'paid' : 'sent'}`}>{trip.status}</span>
                  </td>
                  <td className="amt">{fmt(total)}</td>
                  <td>
                    <button type="button" className="pay-btn" onClick={() => toggleClosed(trip.id, trip.status)}>
                      {trip.status === 'closed' ? 'Reopen' : 'Close'}
                    </button>
                    <button type="button" className="btn danger-link" onClick={() => deleteTrip.mutate(trip.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
