import { Fragment, useState } from 'react'
import { Button } from '../../components/ui'
import { TableScroll } from '../../components/TableScroll'
import { PeriodFilter } from '../../components/PeriodFilter'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { useTrips } from '../../lib/queries/trips'
import { useExpenses } from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'
import type { ExportSection } from '../../lib/export/report'

const COL_SPAN = 8

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
    </div>
  )
}
