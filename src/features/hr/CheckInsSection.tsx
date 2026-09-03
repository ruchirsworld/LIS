import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProfiles } from '../../lib/queries/admin'
import { useLocationPings } from '../../lib/queries/teamTracking'
import { useReverseGeocode, shortenPlaceName } from '../../lib/queries/geocode'
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

// A map link always works with no network round-trip; the place name is
// opt-in per row (Nominatim's fair-use policy caps requests to ~1/sec, so
// this must never auto-fire for every row in a table at once).
function CheckInLocation({ lat, lon }: { lat: number; lon: number }) {
  const [reveal, setReveal] = useState(false)
  const { data: placeName, isLoading, isError } = useReverseGeocode(reveal ? lat : null, reveal ? lon : null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <a href={`https://maps.google.com/?q=${lat},${lon}`} target="_blank" rel="noopener">
        View on map
      </a>
      {!reveal && (
        <button type="button" className="btn link" style={{ fontSize: 11 }} onClick={() => setReveal(true)}>
          Show location name
        </button>
      )}
      {reveal && isLoading && (
        <span className="note" style={{ margin: 0, fontSize: 11 }}>
          Looking up…
        </span>
      )}
      {reveal && !isLoading && placeName && (
        <span className="note" style={{ margin: 0, fontSize: 11 }} title={placeName}>
          {shortenPlaceName(placeName)}
        </span>
      )}
      {reveal && !isLoading && isError && (
        <span className="note" style={{ margin: 0, fontSize: 11, color: 'var(--red)' }}>
          Couldn’t look up name
        </span>
      )}
    </div>
  )
}

// A Supervisor's location is pinged once per login, automatically, just
// from opening the app (see workStore.ts / App.tsx) — this is the
// Admin/CXO view of those pings.
export function CheckInsSection() {
  const { data: profiles } = useProfiles()
  const { data: pings } = useLocationPings()

  const [historySupervisorId, setHistorySupervisorId] = useState('')
  const [fromTime, setFromTime] = useState('08:00')
  const [toTime, setToTime] = useState('19:00')

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  const latestPingByProfile = new Map<string, NonNullable<typeof pings>[number]>()
  for (const ping of pings ?? []) {
    if (!latestPingByProfile.has(ping.profile_id)) latestPingByProfile.set(ping.profile_id, ping)
  }

  const filteredHistory = (pings ?? [])
    .filter((p) => p.profile_id === historySupervisorId)
    .filter((p) => {
      const hhmm = localHHMM(p.taken_at)
      return hhmm >= fromTime && hhmm <= toTime
    })

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 13 }}>Supervisor check-ins</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Most recent location ping from each Supervisor — captured once per login.
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
                  <td>{ping ? <CheckInLocation lat={ping.lat} lon={ping.lon} /> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 13, marginTop: 24, marginBottom: 10 }}>Check-in history</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Every ping for one Supervisor, narrowed to a time window — so a ping outside working hours doesn't need to be
        sifted out by hand.
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
                    No check-ins in this time window
                  </td>
                </tr>
              )}
              {filteredHistory.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.taken_at.slice(0, 10))}</td>
                  <td>{timeOf(p.taken_at)}</td>
                  <td>
                    <CheckInLocation lat={p.lat} lon={p.lon} />
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
