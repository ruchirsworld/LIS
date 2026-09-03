import { useState } from 'react'
import { ATTENDANCE_DAY_TYPE_LABEL, type AttendanceDayType } from '../../lib/calc/payroll'
import { fmtDate } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const DAY_TYPE_COLOR: Record<string, string> = {
  leave: 'var(--amber)',
  absent: 'var(--red)',
  half_day: 'var(--blue)',
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

interface AttendanceEntry {
  staff_id: string
  date: string
  day_type: string
  status: string
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

interface TeamMember {
  id: string
  name: string
  default_project_id?: string | null
}

// A month-grid view of the whole team's leave/absent/half-day exceptions,
// plus which site(s) the team was actually deployed to each day — the
// per-staff table above only shows today plus a leave-count modal, this is
// the "see the whole month at once" complement Admin/CXO need to know where
// work happened, not just who was off.
export function TeamCalendarSection({
  team,
  attendance,
  assignments = [],
  projects = [],
}: {
  team: TeamMember[]
  attendance: AttendanceEntry[]
  assignments?: ProjectAssignmentEntry[]
  projects?: ProjectRef[]
}) {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const teamIds = new Set(team.map((t) => t.id))
  const byDate = new Map<string, AttendanceEntry[]>()
  for (const a of attendance) {
    if (!teamIds.has(a.staff_id)) continue
    const list = byDate.get(a.date) ?? []
    list.push(a)
    byDate.set(a.date, list)
  }

  const assignmentByStaffDate = new Map<string, string>()
  for (const a of assignments) {
    if (!teamIds.has(a.staff_id)) continue
    assignmentByStaffDate.set(`${a.staff_id}:${a.date}`, a.project_id)
  }
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const projectCode = (id: string | null | undefined) => {
    if (!id) return null
    const p = projectById.get(id)
    return p ? p.name ?? p.code ?? p.display_id : null
  }
  // The site a staff member actually worked on a date — the day's override
  // if one was set, else falling back to their own default project, same
  // priority the Supervisor Dashboard's own picker uses.
  function siteFor(staffId: string, date: string, defaultProjectId: string | null | undefined) {
    return assignmentByStaffDate.get(`${staffId}:${date}`) ?? defaultProjectId ?? null
  }
  function siteCodesForDate(date: string): string[] {
    const codes = new Set<string>()
    for (const t of team) {
      const code = projectCode(siteFor(t.id, date, t.default_project_id))
      if (code) codes.add(code)
    }
    return [...codes]
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
          const entries = byDate.get(date) ?? []
          const siteCodes = siteCodesForDate(date)
          return (
            <button
              key={date}
              type="button"
              className={date === today ? 'team-calendar-cell today' : 'team-calendar-cell'}
              disabled={entries.length === 0 && siteCodes.length === 0}
              onClick={() => setSelectedDate(date)}
            >
              <span className="team-calendar-daynum">{dayNum}</span>
              {siteCodes.length > 0 && (
                <span className="note" style={{ margin: 0, fontSize: 10, lineHeight: 1.2, display: 'block' }}>
                  {siteCodes.length > 1 ? `${siteCodes[0]} +${siteCodes.length - 1}` : siteCodes[0]}
                </span>
              )}
              {entries.length > 0 && (
                <span className="team-calendar-dots">
                  {entries.slice(0, 4).map((e, idx) => (
                    <span key={idx} className="team-calendar-dot" style={{ background: DAY_TYPE_COLOR[e.day_type] ?? 'var(--ink-soft)' }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="note" style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="team-calendar-dot" style={{ background: 'var(--amber)' }} /> Leave
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="team-calendar-dot" style={{ background: 'var(--red)' }} /> Absent
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="team-calendar-dot" style={{ background: 'var(--blue)' }} /> Half day
        </span>
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
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const exceptionByStaff = new Map((byDate.get(selectedDate) ?? []).map((e) => [e.staff_id, e]))
                return team.map((t) => {
                  const exception = exceptionByStaff.get(t.id)
                  const siteId = siteFor(t.id, selectedDate, t.default_project_id)
                  const site = siteId ? projectById.get(siteId) : null
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{t.name}</span>
                      <span style={{ textAlign: 'right' }}>
                        <span className="note" style={{ margin: 0 }}>
                          {site ? `${site.code ?? site.display_id ?? ''} ${site.name}`.trim() : 'Site not set'}
                        </span>
                        {exception && (
                          <span className="note" style={{ margin: 0, display: 'block', color: DAY_TYPE_COLOR[exception.day_type] }}>
                            {ATTENDANCE_DAY_TYPE_LABEL[exception.day_type as AttendanceDayType] ?? exception.day_type} ({exception.status})
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
