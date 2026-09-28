import { useState } from 'react'
import { fmtDate } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

interface StaffRef {
  id: string
  supervisor_id: string | null
}

interface ProjectAssignmentEntry {
  staff_id: string
  date: string
  project_id: string
}

interface ProjectRef {
  id: string
  name: string
  code: string | null
  display_id: string | null
}

interface SupervisorRef {
  id: string
  name: string
}

// Admin/CXO's default calendar view, before picking one supervisor's team —
// which site(s) actually had work done on which date, and whose team was
// there, across every supervisor at once. Driven only by the day-specific
// staff_project_assignments records (a Supervisor's "my team is here" call),
// not a default project, since that's the real evidence work happened.
export function SiteWorkCalendarSection({
  staff,
  assignments,
  projects,
  supervisors,
}: {
  staff: StaffRef[]
  assignments: ProjectAssignmentEntry[]
  projects: ProjectRef[]
  supervisors: SupervisorRef[]
}) {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const staffById = new Map(staff.map((s) => [s.id, s]))
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]))
  const projectCode = (id: string) => {
    const p = projectById.get(id)
    return p ? p.name ?? p.code ?? id : id
  }

  // date -> project_id -> supervisor ids whose team was there
  const workByDate = new Map<string, Map<string, Set<string>>>()
  for (const a of assignments) {
    const s = staffById.get(a.staff_id)
    if (!s?.supervisor_id) continue
    const byProject = workByDate.get(a.date) ?? new Map<string, Set<string>>()
    const sups = byProject.get(a.project_id) ?? new Set<string>()
    sups.add(s.supervisor_id)
    byProject.set(a.project_id, sups)
    workByDate.set(a.date, byProject)
  }

  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNum = Number(monthStr)
  const startWeekday = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const today = todayStr()
  const selectedWork = selectedDate ? workByDate.get(selectedDate) ?? new Map<string, Set<string>>() : new Map()

  return (
    <div className="card" style={{ padding: 16, marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button type="button" className="pay-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <h3 style={{ margin: 0, fontSize: 13 }}>{monthLabel(month)}</h3>
        <button type="button" className="pay-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="team-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="team-calendar-weekday">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="team-calendar-cell empty" />
          const dayNum = Number(date.slice(-2))
          const byProject = workByDate.get(date)
          const codes = byProject ? [...byProject.keys()].map(projectCode) : []
          return (
            <button
              key={date}
              type="button"
              className={date === today ? 'team-calendar-cell today' : 'team-calendar-cell'}
              disabled={codes.length === 0}
              onClick={() => setSelectedDate(date)}
            >
              <span className="team-calendar-daynum">{dayNum}</span>
              {codes.length > 0 && (
                <span className="note" style={{ margin: 0, fontSize: 10, lineHeight: 1.2, display: 'block' }}>
                  {codes.length > 1 ? `${codes[0]} +${codes.length - 1}` : codes[0]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="note" style={{ marginTop: 10 }}>
        Pick a supervisor above to switch this calendar to their team's attendance.
      </div>

      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{fmtDate(selectedDate)}</strong>
              <button type="button" className="modal-close" onClick={() => setSelectedDate(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedWork.size === 0 && <div className="empty-state">No site recorded for this date.</div>}
              {[...selectedWork.entries()].map(([projectId, sups]) => {
                const p = projectById.get(projectId)
                return (
                  <div key={projectId}>
                    <strong>
                      {p?.code ?? p?.display_id ? `${p?.code ?? p?.display_id} — ` : ''}
                      {p?.name ?? projectId}
                    </strong>
                    <div className="note" style={{ margin: '2px 0 0' }}>
                      {[...sups].map((id) => supervisorById.get(id)?.name ?? '—').join(', ')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
