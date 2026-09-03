import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProfiles } from '../../lib/queries/admin'
import { useStaff } from '../../lib/queries/masters'
import { useLocationPings, useAllStaffAttendance } from '../../lib/queries/teamTracking'
import { fmtDate } from '../../lib/calc/format'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// "HH:MM" in the viewer's local time, for comparing against a ping's local
// time-of-day the same way timeOf() displays it.
function localHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// A staff member counts as "present" on a date if they were actually
// employed that day and nothing marks them Absent/Leave — the same
// implicit-present model attendance uses everywhere else (no record at all
// means Present; only exceptions get a row). Half-day still counts as
// present since they were on site for part of the day.
function staffPresentOn(
  s: { start_date: string; end_date: string | null },
  date: string,
  recordsForStaff: { date: string; day_type: string }[]
): boolean {
  if (date < s.start_date) return false
  if (s.end_date && date > s.end_date) return false
  const record = recordsForStaff.find((r) => r.date === date)
  return !record || (record.day_type !== 'absent' && record.day_type !== 'leave')
}

// A Supervisor's location is pinged once per login, automatically, just
// from opening the app (see workStore.ts / App.tsx) — this is the
// Admin/CXO view of those pings.
export function CheckInsSection() {
  const { data: profiles } = useProfiles()
  const { data: staff } = useStaff()
  const { data: allAttendance } = useAllStaffAttendance()
  const { data: pings } = useLocationPings()

  const [historySupervisorId, setHistorySupervisorId] = useState('')
  const [fromTime, setFromTime] = useState('08:00')
  const [toTime, setToTime] = useState('19:00')

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  const latestPingByProfile = new Map<string, NonNullable<typeof pings>[number]>()
  for (const ping of pings ?? []) {
    if (!latestPingByProfile.has(ping.profile_id)) latestPingByProfile.set(ping.profile_id, ping)
  }

  const team = (staff ?? []).filter((s) => s.supervisor_id === historySupervisorId)
  const attendanceByStaffId = new Map<string, { date: string; day_type: string }[]>()
  for (const a of allAttendance ?? []) {
    const list = attendanceByStaffId.get(a.staff_id) ?? []
    list.push(a)
    attendanceByStaffId.set(a.staff_id, list)
  }
  // Attendance rows only exist for exceptions (a normal fully-present day
  // never gets one at all), so "team present" can't be read off attendance
  // directly — check every date any of this supervisor's own pings fall on
  // instead, against each team member's employment window and exceptions.
  const teamPresentDates = new Set<string>()
  for (const p of pings ?? []) {
    if (p.profile_id !== historySupervisorId) continue
    const date = p.taken_at.slice(0, 10)
    if (team.some((s) => staffPresentOn(s, date, attendanceByStaffId.get(s.id) ?? []))) teamPresentDates.add(date)
  }

  const filteredHistory = (pings ?? [])
    .filter((p) => p.profile_id === historySupervisorId)
    .filter((p) => {
      const hhmm = localHHMM(p.taken_at)
      return hhmm >= fromTime && hhmm <= toTime
    })
    .filter((p) => teamPresentDates.has(p.taken_at.slice(0, 10)))

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 13 }}>Supervisor check-ins</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Most recent location ping from each Supervisor — captured once on login, plus every 30 min while "Start Work"
        is active.
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Supervisor</th>
              <th>Last check-in</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {supervisors.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-row">
                  No supervisors yet
                </td>
              </tr>
            )}
            {supervisors.map((s) => {
              const ping = latestPingByProfile.get(s.id)
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{ping ? `${fmtDate(ping.taken_at.slice(0, 10))} ${timeOf(ping.taken_at)}` : '—'}</td>
                  <td>
                    {ping ? (
                      <a href={`https://maps.google.com/?q=${ping.lat},${ping.lon}`} target="_blank" rel="noopener">
                        View on map
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 13, marginTop: 24, marginBottom: 10 }}>Check-in history</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Every ping for one Supervisor, narrowed to a time window and to days their team was actually present — so a
        ping from a day off, or outside working hours, doesn't need to be sifted out by hand.
      </div>
      <div className="form-grid" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="field">
          <label>Supervisor</label>
          <SearchableSelect
            items={supervisors}
            value={historySupervisorId}
            onChange={setHistorySupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select supervisor —"
          />
        </div>
        <div className="field-row">
          <div className="field field-narrow">
            <label>From</label>
            <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          </div>
          <div className="field field-narrow">
            <label>To</label>
            <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </div>
        </div>
      </div>

      {!historySupervisorId ? (
        <div className="note">Pick a supervisor to see their check-in history.</div>
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No check-ins in this window on a day their team was present
                  </td>
                </tr>
              )}
              {filteredHistory.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.taken_at.slice(0, 10))}</td>
                  <td>{timeOf(p.taken_at)}</td>
                  <td>
                    <a href={`https://maps.google.com/?q=${p.lat},${p.lon}`} target="_blank" rel="noopener">
                      View on map
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
