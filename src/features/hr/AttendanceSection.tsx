import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useStaff, useProjects } from '../../lib/queries/masters'
import { useProfiles, useSupervisorProjects } from '../../lib/queries/admin'
import {
  useAllStaffAttendance,
  useAllStaffProjectAssignments,
  useMarkLeave,
  useRemoveLeave,
  useStaffProjectAssignmentsForDate,
  useSetStaffProjectAssignment,
  useClearStaffProjectAssignment,
} from '../../lib/queries/teamTracking'
import { useHolidays } from '../../lib/queries/hr'
import { leaveFreeDates, freeLeaveQuotaInfo, type AttendanceDayType } from '../../lib/calc/payroll'
import { fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function AttendanceMarkingSection() {
  const { profile } = useAuth()
  const { data: staff } = useStaff()
  const { data: profiles } = useProfiles()
  const { data: records } = useAllStaffAttendance()
  const { data: allAssignments } = useAllStaffProjectAssignments()
  const { data: projects } = useProjects()
  const { data: holidays } = useHolidays()
  const markAttendance = useMarkLeave()
  const removeAttendance = useRemoveLeave()

  const [supervisorId, setSupervisorId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [rowError, setRowError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Present is the default for everyone until changed — day_type '' means
  // Present. Edits stage here and only save when "Submit attendance" is
  // clicked, rather than writing on every dropdown change.
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({})
  const [openLeaveDatesStaffId, setOpenLeaveDatesStaffId] = useState<string | null>(null)

  const { data: assignmentsForDate } = useStaffProjectAssignmentsForDate(date)
  const { data: supervisorProjects } = useSupervisorProjects(supervisorId || null)
  const setAssignment = useSetStaffProjectAssignment()
  const clearAssignment = useClearStaffProjectAssignment()

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  // Only staff who had actually joined (and hadn't yet left) as of the date
  // being marked — not today's roster, so a past date doesn't show someone
  // who wasn't employed yet, and marking a past team doesn't miss someone
  // who has since left.
  const team = (staff ?? []).filter(
    (s) => s.supervisor_id === supervisorId && s.start_date <= date && (!s.end_date || s.end_date >= date)
  )

  const recordFor = (staffId: string) => records?.find((r) => r.staff_id === staffId && r.date === date)
  const assignmentFor = (staffId: string) => assignmentsForDate?.find((a) => a.staff_id === staffId)?.project_id ?? ''
  const projectName = (id: string | null | undefined) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : null)

  // A defined Holiday always pays full, regardless of what's marked — see
  // computeAccrued in lib/calc/payroll.ts. The dropdown is replaced with a
  // plain "Holiday" label on these dates since marking someone Leave/Absent
  // here wouldn't change their pay anyway.
  const holiday = holidays?.find((h) => h.date === date)

  const monthPrefix = date.slice(0, 7)
  const holidayDates = new Set((holidays ?? []).map((h) => h.date))
  // Every marked exception (leave/absent/half-day) this month — same "click
  // the count to see the dates" convention as the Supervisor Dashboard. A
  // Holiday always pays regardless of any stray marking on it (see
  // computeAccrued), so it's excluded here too — it belongs only in the
  // Holidays group below, never Leave/Absent/Half day.
  const leaveRecordsFor = (staffId: string) =>
    (records ?? [])
      .filter((r) => r.staff_id === staffId && r.date.startsWith(monthPrefix) && !holidayDates.has(r.date))
      .sort((a, b) => a.date.localeCompare(b.date))

  // Same rule as the Supervisor Dashboard's own site picker — only offer the
  // projects this supervisor is assigned to, falling back to every active
  // project if nobody has set up assignments for them yet.
  const assignedIds = new Set((supervisorProjects ?? []).map((a) => a.project_id))
  const pickableProjects =
    assignedIds.size > 0 ? (projects ?? []).filter((p) => assignedIds.has(p.id)) : projects ?? []

  useEffect(() => {
    const seededAttendance: Record<string, string> = {}
    const seededProjects: Record<string, string> = {}
    for (const s of team) {
      seededAttendance[s.id] = recordFor(s.id)?.day_type ?? ''
      seededProjects[s.id] = assignmentFor(s.id)
    }
    setDraft(seededAttendance)
    setProjectDraft(seededProjects)
    setRowError(null)
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisorId, date])

  async function handleSubmit() {
    setRowError(null)
    setSubmitted(false)
    setSubmitting(true)
    try {
      await Promise.all(
        team.map(async (s) => {
          const dayType = draft[s.id] ?? ''
          const record = recordFor(s.id)
          const current = record?.day_type ?? ''
          // Submit always finalizes every marked entry as approved — not
          // just the ones edited in this session. Otherwise a Supervisor's
          // untouched 'pending' mark (Admin agrees with it, so never
          // changes the value) would never actually get approved, since
          // there'd be no value change to trigger a write.
          const needsWrite = dayType !== current || (!!dayType && record?.status !== 'approved')
          if (needsWrite) {
            if (!dayType) {
              await removeAttendance.mutateAsync({ staffId: s.id, date })
            } else {
              await markAttendance.mutateAsync({
                staff_id: s.id,
                date,
                day_type: dayType as AttendanceDayType,
                status: 'approved',
                created_by: profile?.id,
              })
            }
          }

          const projectId = projectDraft[s.id] ?? ''
          const currentProjectId = assignmentFor(s.id)
          if (projectId !== currentProjectId) {
            if (!projectId) {
              await clearAssignment.mutateAsync({ staffId: s.id, date })
            } else {
              await setAssignment.mutateAsync({ staff_id: s.id, date, project_id: projectId, created_by: profile?.id })
            }
          }
        })
      )
      setSubmitted(true)
    } catch (err) {
      setRowError(getErrorMessage(err, 'Could not submit attendance.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <h3 style={{ marginTop: 0, fontSize: 13 }}>Mark attendance</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Everyone is Present by default until marked otherwise. The first 4 Absent days in a calendar month are
        still full-pay (counted as Leave); any beyond that are unpaid. Half day always pays half — see Salary for
        how this feeds payroll.
      </div>

      <div className="form-grid" style={{ marginTop: 0 }}>
        <div className="field">
          <label>Supervisor</label>
          <SearchableSelect
            items={supervisors}
            value={supervisorId}
            onChange={setSupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select supervisor —"
          />
        </div>
        <div className="field field-narrow">
          <label>Date</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="pay-btn"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              aria-label="Previous day"
            >
              ‹
            </button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
            <button
              type="button"
              className="pay-btn"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              aria-label="Next day"
            >
              ›
            </button>
          </div>
        </div>
      </div>
      {holiday && (
        <div className="note" style={{ color: 'var(--accent)', marginTop: -10, marginBottom: 12 }}>
          🎉 {holiday.name} — Holiday. The whole team is paid in full for this day regardless of marking.
        </div>
      )}
      {rowError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {rowError}
        </div>
      )}

      {!supervisorId ? (
        <div className="note" style={{ marginTop: 16 }}>
          Pick a supervisor to see their team.
        </div>
      ) : (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Total OFF ({monthPrefix})</th>
                <th>Attendance ({fmtDate(date)})</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No team members assigned to this supervisor
                  </td>
                </tr>
              )}
              {team.map((s) => {
                const record = recordFor(s.id)
                const leaveRecords = leaveRecordsFor(s.id)
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      <button
                        type="button"
                        className="pay-btn"
                        disabled={leaveRecords.length === 0}
                        onClick={() => setOpenLeaveDatesStaffId(s.id)}
                        title="Click to see this month's Leave/Absent/Half-day dates"
                      >
                        {leaveRecords.length}
                      </button>
                    </td>
                    <td>
                      {holiday ? (
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 4 }}>
                            <input
                              type="checkbox"
                              checked={!!projectDraft[s.id]}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProjectDraft((d) => ({
                                    ...d,
                                    [s.id]: d[s.id] || s.default_project_id || pickableProjects[0]?.id || '',
                                  }))
                                } else {
                                  setProjectDraft((d) => ({ ...d, [s.id]: '' }))
                                }
                              }}
                            />
                            Worked this Holiday
                          </label>
                          {projectDraft[s.id] ? (
                            <div>
                              <span className="badge paid">Comp-off earned</span>
                              <div className="note" style={{ margin: '4px 0 0' }}>
                                Gets an extra paid day off this month — check their Site is correct too.
                              </div>
                            </div>
                          ) : (
                            <span className="badge paid">Holiday (Paid)</span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="pay-btn"
                            aria-pressed={draft[s.id] === 'absent'}
                            aria-label={`Mark ${s.name} absent`}
                            title="Absent"
                            style={{
                              fontSize: 15,
                              lineHeight: 1,
                              ...(draft[s.id] === 'absent' ? { background: 'var(--red)', color: '#fff' } : undefined),
                            }}
                            onClick={() =>
                              setDraft((d) => ({ ...d, [s.id]: d[s.id] === 'absent' ? '' : 'absent' }))
                            }
                          >
                            ✕
                          </button>
                          <button
                            type="button"
                            className="pay-btn"
                            aria-pressed={draft[s.id] === 'half_day'}
                            aria-label={`Mark ${s.name} half day`}
                            title="Half day"
                            style={{
                              fontSize: 15,
                              lineHeight: 1,
                              ...(draft[s.id] === 'half_day' ? { background: 'var(--blue)', color: '#fff' } : undefined),
                            }}
                            onClick={() =>
                              setDraft((d) => ({ ...d, [s.id]: d[s.id] === 'half_day' ? '' : 'half_day' }))
                            }
                          >
                            ◐
                          </button>
                          {!draft[s.id] && (
                            <span className="note" style={{ margin: 0, fontSize: 15 }} title="Present">
                              ✓
                            </span>
                          )}
                          {record && (
                            <span className="note" style={{ margin: 0 }}>({record.status})</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={`Site for ${s.name}`}
                        value={projectDraft[s.id] ?? ''}
                        onChange={(e) => setProjectDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      >
                        <option value="">Default ({projectName(s.default_project_id) ?? 'not set'})</option>
                        {pickableProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {supervisorId && team.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Submitting…' : 'Submit attendance'}
          </Button>
          {submitted && !rowError && (
            <span className="note" style={{ margin: 0, color: 'var(--green)' }}>
              ✓ Saved
            </span>
          )}
        </div>
      )}

      {openLeaveDatesStaffId && (
        <div className="modal-backdrop" onClick={() => setOpenLeaveDatesStaffId(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{team.find((s) => s.id === openLeaveDatesStaffId)?.name} — {monthPrefix}</strong>
              <button type="button" className="modal-close" onClick={() => setOpenLeaveDatesStaffId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                // Same rule computeAccrued uses for pay: the first N
                // Absent/Leave dates in the month are free (paid, counted
                // as Leave) — split the popup the same way so it explains
                // why a given day was or wasn't paid. N is pro-rated down
                // for a mid-month join/exit, same as payroll itself — a
                // flat "first 4" would overstate it for a partial month.
                const member = team.find((t) => t.id === openLeaveDatesStaffId)
                const { quota: baseQuota, isProRated } = member
                  ? freeLeaveQuotaInfo(member, monthPrefix)
                  : { quota: 4, isProRated: false }
                // Comp-off: a Holiday actually worked earns one extra free
                // day that month, on top of the base pro-rated quota.
                const compOffEarned = member
                  ? (allAssignments ?? []).filter(
                      (a) => a.staff_id === member.id && a.date.startsWith(monthPrefix) && holidayDates.has(a.date)
                    ).length
                  : 0
                const quota = baseQuota + compOffEarned
                const allRows = leaveRecordsFor(openLeaveDatesStaffId)
                const offRows = allRows.filter((r) => r.day_type === 'absent' || r.day_type === 'leave')
                const freeDates = leaveFreeDates(offRows.map((r) => r.date), () => quota)
                const paidLeaveRows = offRows.filter((r) => freeDates.has(r.date))
                const unpaidAbsentRows = offRows.filter((r) => !freeDates.has(r.date))
                const halfDayRows = allRows.filter((r) => r.day_type === 'half_day')
                // paidLeaveRows is already date-ascending (leaveRecordsFor
                // sorts, filter preserves order) — whatever falls beyond the
                // base quota is only paid because of comp-off earned this
                // month, so call out which date that actually is.
                const compOffDates = new Set(paidLeaveRows.slice(baseQuota).map((r) => r.date))

                // Visible header stays a plain "Paid Leaves (N)" — the quota
                // breakdown (pro-rata, comp-off) is still there on hover, and
                // the specific comp-off date(s) are called out inline below.
                const leaveTitle = `First ${baseQuota}${isProRated ? ' (pro rata)' : ''} free${compOffEarned > 0 ? ` + ${compOffEarned} comp-off` : ''}`

                const groups: { label: string; rows: typeof allRows; title?: string }[] = [
                  { label: 'Paid Leaves', rows: paidLeaveRows, title: leaveTitle },
                  { label: 'Absent', rows: unpaidAbsentRows },
                  { label: 'Half Days', rows: halfDayRows },
                ]

                return groups.map(
                  (group) =>
                    group.rows.length > 0 && (
                      <div key={group.label}>
                        <div style={{ fontSize: 15, color: 'var(--ink, inherit)', marginBottom: 6 }} title={group.title}>
                          {group.label} <strong style={{ fontWeight: 700 }}>({group.rows.length})</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {group.rows.map((r) => (
                            <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                              <span>
                                {fmtDate(r.date)}
                                {compOffDates.has(r.date) ? ' (comp off)' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )
              })()}
              {(() => {
                const monthHolidays = (holidays ?? []).filter((h) => h.date.startsWith(monthPrefix))
                if (monthHolidays.length === 0) return null
                return (
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--ink, inherit)', marginBottom: 6 }}>
                      Holidays <strong style={{ fontWeight: 700 }}>({monthHolidays.length})</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {monthHolidays.map((h) => (
                        <div key={h.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                          <span>{fmtDate(h.date)}</span>
                          <span className="note" style={{ margin: 0 }}>{h.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {leaveRecordsFor(openLeaveDatesStaffId).length === 0 &&
                (holidays ?? []).filter((h) => h.date.startsWith(monthPrefix)).length === 0 && (
                  <div className="note">Nothing recorded this month.</div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AttendanceSection() {
  return (
    <div>
      <AttendanceMarkingSection />
      <div className="note">Company holidays are managed under Settings → General Settings.</div>
    </div>
  )
}
