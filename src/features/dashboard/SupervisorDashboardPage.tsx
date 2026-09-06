import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import { useStaff, useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import {
  useStaffAttendanceForDate,
  useAllStaffAttendance,
  useAllStaffProjectAssignments,
  useMarkLeave,
  useRemoveLeave,
  useStaffProjectAssignmentsForDate,
  useSetStaffProjectAssignment,
  useClearStaffProjectAssignment,
} from '../../lib/queries/teamTracking'
import { useSupervisorProjects } from '../../lib/queries/admin'
import { useExpenses } from '../../lib/queries/expenses'
import { useHolidays, useStaffImprestTransactions } from '../../lib/queries/hr'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE } from '../../lib/supervisorProjectExpenseCategories'
import { ATTENDANCE_DAY_TYPE_LABEL, leaveFreeDates, freeLeaveQuotaInfo, type AttendanceDayType } from '../../lib/calc/payroll'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ModuleHeader, KpiCard } from '../../components/ui'

type ExpandedKpi = 'claims' | 'payments' | null
type KpiPeriod = 'week' | 'month' | 'custom'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Monday through today, in UTC-space to stay timezone-agnostic like the rest
// of this file's date math.
function currentWeekRange(todayIso: string): { from: string; to: string } {
  const d = new Date(`${todayIso}T00:00:00Z`)
  const diffToMonday = (d.getUTCDay() + 6) % 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - diffToMonday)
  return { from: monday.toISOString().slice(0, 10), to: todayIso }
}

// Remembers a Supervisor's last-picked project across days, purely as a UI
// default — so most mornings they don't have to re-pick the same project
// their team is always on. Keyed per profile in case a device is shared.
function lastProjectKey(profileId: string) {
  return `supervisor-last-project:${profileId}`
}
function readLastProject(profileId: string): string {
  try {
    return localStorage.getItem(lastProjectKey(profileId)) ?? ''
  } catch {
    return ''
  }
}
function writeLastProject(profileId: string, projectId: string) {
  try {
    if (projectId) localStorage.setItem(lastProjectKey(profileId), projectId)
    else localStorage.removeItem(lastProjectKey(profileId))
  } catch {
    // ignore — purely a UX convenience, safe to skip if storage is unavailable
  }
}

export function SupervisorDashboardPage() {
  const { profile } = useAuth()
  const t = useT()
  const today = todayStr()
  // The date the whole page — attendance, project assignment, leave count —
  // is being viewed/edited for. Defaults to today; tapping the date next to
  // "My team" opens a native date picker to move it, e.g. to correct
  // yesterday's marking without waiting for the next day.
  const [selectedDate, setSelectedDate] = useState(today)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const monthPrefix = selectedDate.slice(0, 7)
  const [openLeaveDatesStaffId, setOpenLeaveDatesStaffId] = useState<string | null>(null)
  const [expandedKpi, setExpandedKpi] = useState<ExpandedKpi>(null)
  // Claims/Payments KPI period — defaults to the current month.
  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>('month')
  const [kpiCustomFrom, setKpiCustomFrom] = useState(`${today.slice(0, 7)}-01`)
  const [kpiCustomTo, setKpiCustomTo] = useState(today)

  const { data: staff } = useStaff()
  const { data: projects } = useProjects()
  const { data: supervisorProjects } = useSupervisorProjects(profile?.id ?? null)
  const { data: attendanceForDate } = useStaffAttendanceForDate(selectedDate)
  const { data: allAttendance } = useAllStaffAttendance()
  const { data: assignmentsForDate } = useStaffProjectAssignmentsForDate(selectedDate)
  const { data: allAssignments } = useAllStaffProjectAssignments()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: pendingExpenses } = useExpenses(null, 'pending')
  const { data: holidays } = useHolidays()
  const { data: imprestTransactions } = useStaffImprestTransactions()
  const markLeave = useMarkLeave()
  const removeLeave = useRemoveLeave()
  const setAssignment = useSetStaffProjectAssignment()
  const clearAssignment = useClearStaffProjectAssignment()

  // Filtered against the date being viewed, not today — so looking at a
  // past date only shows who had actually joined (and hadn't yet left) as
  // of that date, not today's current roster.
  const myTeam = (staff ?? []).filter(
    (s) => s.supervisor_id === profile?.id && s.start_date <= selectedDate && (!s.end_date || s.end_date >= selectedDate)
  )

  const attendanceByStaff = new Map((attendanceForDate ?? []).map((a) => [a.staff_id, a]))
  const assignmentByStaff = new Map((assignmentsForDate ?? []).map((a) => [a.staff_id, a.project_id]))

  // Blank when the team isn't uniformly on one project on this date (split,
  // or nothing picked yet) — the picker only shows a value when it can
  // speak for the whole team.
  const teamAssignments = myTeam.map((s) => assignmentByStaff.get(s.id))
  const sitePickerValue =
    teamAssignments.length > 0 && teamAssignments.every((p) => p && p === teamAssignments[0]) ? teamAssignments[0]! : ''

  const projectName = (id: string | null | undefined) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : null)

  // Only offer the projects this Supervisor is actually assigned to — falls
  // back to every active project if nobody has set up assignments yet, so a
  // freshly added Supervisor isn't locked out of picking a site.
  const assignedIds = new Set((supervisorProjects ?? []).map((a) => a.project_id))
  const pickableProjects =
    assignedIds.size > 0 ? (projects ?? []).filter((p) => assignedIds.has(p.id)) : projects ?? []

  // Picking a site here is the Supervisor's "my team is here" call for the
  // selected date — it links every current team member to it, taking
  // priority over each staff member's default_project_id. Any one member
  // can still be moved elsewhere individually below.
  async function applySiteToTeam(projectId: string) {
    if (!profile) return
    if (projectId) {
      await Promise.all(
        myTeam.map((s) =>
          setAssignment.mutateAsync({ staff_id: s.id, date: selectedDate, project_id: projectId, created_by: profile.id })
        )
      )
      if (selectedDate === today) writeLastProject(profile.id, projectId)
    } else {
      await Promise.all(myTeam.map((s) => clearAssignment.mutateAsync({ staffId: s.id, date: selectedDate })))
      if (selectedDate === today) writeLastProject(profile.id, '')
    }
  }

  async function changeStaffProject(staffId: string, projectId: string) {
    if (!profile) return
    if (projectId) {
      await setAssignment.mutateAsync({ staff_id: staffId, date: selectedDate, project_id: projectId, created_by: profile.id })
    } else {
      await clearAssignment.mutateAsync({ staffId, date: selectedDate })
    }
  }

  // If nobody on the team has an override recorded for today yet, default to
  // whichever site the Supervisor picked last rather than leaving it unset —
  // most days it's the same site. Fires once, only for today's own date, and
  // only once the team roster and today's assignments have actually loaded.
  const autoApplied = useRef(false)
  useEffect(() => {
    if (autoApplied.current) return
    if (selectedDate !== today) return
    if (!profile || myTeam.length === 0) return
    if (assignmentsForDate === undefined) return
    autoApplied.current = true
    if (myTeam.some((s) => assignmentByStaff.has(s.id))) return
    const last = readLastProject(profile.id)
    if (last && (projects ?? []).some((p) => p.id === last)) void applySiteToTeam(last)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, myTeam.length, assignmentsForDate, selectedDate])

  const holidayDates = new Set((holidays ?? []).map((h) => h.date))
  const holidayToday = holidays?.find((h) => h.date === selectedDate)

  // A Holiday always pays regardless of any stray marking on it (see
  // computeAccrued), so it's excluded here — it isn't a real Leave/Absent.
  const leaveRecordsByStaff = new Map<string, { date: string; day_type: string }[]>()
  for (const a of allAttendance ?? []) {
    if (!a.date.startsWith(monthPrefix) || holidayDates.has(a.date)) continue
    const list = leaveRecordsByStaff.get(a.staff_id) ?? []
    list.push({ date: a.date, day_type: a.day_type })
    leaveRecordsByStaff.set(a.staff_id, list)
  }
  for (const list of leaveRecordsByStaff.values()) list.sort((a, b) => a.date.localeCompare(b.date))

  // A Supervisor's own marking starts Pending until an Admin approves it —
  // once Approved it's locked, shown as-is here. Empty string = Present
  // (clears any exception recorded for the selected date).
  async function changeStaffAttendance(staffId: string, dayType: string) {
    if (!profile) return
    if (!dayType) {
      await removeLeave.mutateAsync({ staffId, date: selectedDate })
    } else {
      await markLeave.mutateAsync({
        staff_id: staffId,
        date: selectedDate,
        day_type: dayType as AttendanceDayType,
        status: 'pending',
        created_by: profile.id,
      })
    }
  }

  const kpiRange =
    kpiPeriod === 'week'
      ? currentWeekRange(today)
      : kpiPeriod === 'month'
        ? { from: `${today.slice(0, 7)}-01`, to: today }
        : { from: kpiCustomFrom, to: kpiCustomTo }
  const kpiRangeInvalid = kpiPeriod === 'custom' && kpiCustomFrom > kpiCustomTo
  const inKpiRange = (date: string) => !kpiRangeInvalid && date >= kpiRange.from && date <= kpiRange.to

  const myPendingExpenses = (pendingExpenses ?? [])
    .filter((e) => e.created_by === profile?.id && inKpiRange(e.date))
    .sort((a, b) => b.date.localeCompare(a.date))
  const myPendingTotal = myPendingExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  // The Chart of Accounts sub-head name (e.g. "Project Transportation")
  // isn't what the Supervisor picked when filing the claim — map its code
  // back to the same fixed category label the claim form itself uses
  // ("Transport", "Labour", ...).
  const claimCategoryLabelByCode = new Map<string, string>([[LABOUR_SUB_HEAD_CODE, 'Labour']])
  for (const c of FIXED_EXPENSE_CATEGORIES) claimCategoryLabelByCode.set(c.subHeadCode, c.label)
  const categoryName = (subHeadId: string | null) => {
    if (!subHeadId) return '—'
    const subHead = subHeads?.find((s) => s.id === subHeadId)
    if (!subHead) return '—'
    return claimCategoryLabelByCode.get(subHead.code) ?? subHead.name
  }

  const pendingByDate = new Map<string, typeof myPendingExpenses>()
  for (const e of myPendingExpenses) {
    const list = pendingByDate.get(e.date) ?? []
    list.push(e)
    pendingByDate.set(e.date, list)
  }
  const pendingDates = [...pendingByDate.keys()].sort((a, b) => b.localeCompare(a))

  // "Payments received" — Site Imprest advances actually paid out to this
  // Supervisor, not their claims (those are the "Claims (Pending)" KPI). A
  // request they've made themselves (Expenses → Request advance) stays out
  // of this total until an Admin approves it.
  const myAdvances = (imprestTransactions ?? [])
    .filter((t) => t.profile_id === profile?.id && t.kind === 'advance' && t.status === 'approved' && inKpiRange(t.date))
    .sort((a, b) => b.date.localeCompare(a.date))
  const myAdvancesTotal = myAdvances.reduce((s, t) => s + Number(t.amount || 0), 0)

  const advancesByDate = new Map<string, typeof myAdvances>()
  for (const t of myAdvances) {
    const list = advancesByDate.get(t.date) ?? []
    list.push(t)
    advancesByDate.set(t.date, list)
  }
  const advanceDates = [...advancesByDate.keys()].sort((a, b) => b.localeCompare(a))

  function toggleKpi(kpi: ExpandedKpi) {
    setExpandedKpi((cur) => (cur === kpi ? null : kpi))
  }

  return (
    <div>
      <ModuleHeader>{t('Dashboard')}</ModuleHeader>

      {myTeam.length > 0 && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label htmlFor="sup-site">{t('Site')}</label>
          <select id="sup-site" value={sitePickerValue} onChange={(e) => void applySiteToTeam(e.target.value)}>
            <option value="">{t('Not set')}</option>
            {pickableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>{t('Attendance')}</h3>
        <button
          type="button"
          className="pay-btn"
          style={{ fontSize: 16, fontWeight: 700 }}
          onClick={() => setShowDatePicker((v) => !v)}
        >
          {fmtDate(selectedDate)}
        </button>
        {showDatePicker && (
          <input
            type="date"
            autoFocus
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value || today)
              setShowDatePicker(false)
            }}
          />
        )}
        {selectedDate !== today && (
          <button type="button" className="pay-btn" onClick={() => setSelectedDate(today)}>
            {t('Today')}
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>{t('Name')}</th>
              <th>{t('OFF(s)')}</th>
              <th>{fmtDate(selectedDate)}</th>
              <th>{t('Site')}</th>
            </tr>
          </thead>
          <tbody>
            {myTeam.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  {t('No team members assigned to you yet')}
                </td>
              </tr>
            )}
            {myTeam.map((s) => {
              const record = attendanceByStaff.get(s.id)
              const approved = record?.status === 'approved'
              const leaveRecords = leaveRecordsByStaff.get(s.id) ?? []
              const staffProjectOverride = assignmentByStaff.get(s.id) ?? ''
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <button
                      type="button"
                      className="pay-btn"
                      disabled={leaveRecords.length === 0}
                      onClick={() => setOpenLeaveDatesStaffId(s.id)}
                    >
                      {leaveRecords.length}
                    </button>
                  </td>
                  <td>
                    {holidayToday ? (
                      <div>
                        <span className="badge paid">{t('Holiday (Paid)')}</span>
                        <div className="note" style={{ margin: '4px 0 0' }}>
                          {t('Worked anyway? Set their Site → earns a compensatory leave this month.')}
                        </div>
                      </div>
                    ) : approved ? (
                      <span className="badge paid">
                        {t(ATTENDANCE_DAY_TYPE_LABEL[record?.day_type as AttendanceDayType] ?? 'Leave')} ({t('approved')})
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="pay-btn"
                          aria-pressed={record?.day_type === 'absent'}
                          aria-label={`Mark ${s.name} absent`}
                          title={t('Absent')}
                          style={{
                            fontSize: 15,
                            lineHeight: 1,
                            ...(record?.day_type === 'absent' ? { background: 'var(--red)', color: '#fff' } : undefined),
                          }}
                          onClick={() => void changeStaffAttendance(s.id, record?.day_type === 'absent' ? '' : 'absent')}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          className="pay-btn"
                          aria-pressed={record?.day_type === 'half_day'}
                          aria-label={`Mark ${s.name} half day`}
                          title={t('Half day')}
                          style={{
                            fontSize: 15,
                            lineHeight: 1,
                            ...(record?.day_type === 'half_day' ? { background: 'var(--blue)', color: '#fff' } : undefined),
                          }}
                          onClick={() => void changeStaffAttendance(s.id, record?.day_type === 'half_day' ? '' : 'half_day')}
                        >
                          ◐
                        </button>
                        {!record && (
                          <span className="note" style={{ margin: 0, fontSize: 15 }} title={t('Present')}>
                            ✓
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={`Site for ${s.name}`}
                      value={staffProjectOverride}
                      onChange={(e) => void changeStaffProject(s.id, e.target.value)}
                    >
                      <option value="">
                        {t('Default')} ({projectName(s.default_project_id) ?? t('not set')})
                      </option>
                      {pickableProjects
                        .filter((p) => p.id !== s.default_project_id)
                        .map((p) => (
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

      {openLeaveDatesStaffId && (
        <div className="modal-backdrop" onClick={() => setOpenLeaveDatesStaffId(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{myTeam.find((s) => s.id === openLeaveDatesStaffId)?.name} — {monthPrefix}</strong>
              <button type="button" className="modal-close" onClick={() => setOpenLeaveDatesStaffId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                // Same breakdown as the Admin side's Attendance page: the
                // first N Absent/Leave dates this month are free (paid,
                // counted as Leave), N pro-rated for a mid-month join/exit
                // and bumped by any Holiday actually worked (comp-off).
                const member = myTeam.find((t) => t.id === openLeaveDatesStaffId)
                const { quota: baseQuota, isProRated } = member
                  ? freeLeaveQuotaInfo(member, monthPrefix)
                  : { quota: 4, isProRated: false }
                const compOffEarned = member
                  ? (allAssignments ?? []).filter(
                      (a) => a.staff_id === member.id && a.date.startsWith(monthPrefix) && holidayDates.has(a.date)
                    ).length
                  : 0
                const quota = baseQuota + compOffEarned
                const allRows = leaveRecordsByStaff.get(openLeaveDatesStaffId) ?? []
                const offRows = allRows.filter((r) => r.day_type === 'absent' || r.day_type === 'leave')
                const freeDates = leaveFreeDates(offRows.map((r) => r.date), () => quota)
                const paidLeaveRows = offRows.filter((r) => freeDates.has(r.date))
                const unpaidAbsentRows = offRows.filter((r) => !freeDates.has(r.date))
                const halfDayRows = allRows.filter((r) => r.day_type === 'half_day')
                // paidLeaveRows is already date-ascending — whatever falls
                // beyond the base quota is only paid because of comp-off
                // earned this month, so call out which date that actually is.
                const compOffDates = new Set(paidLeaveRows.slice(baseQuota).map((r) => r.date))

                const leaveTitle = `${t('First')} ${baseQuota}${isProRated ? ` (${t('pro rata')})` : ''} ${t('free')}${compOffEarned > 0 ? ` + ${compOffEarned} ${t('comp-off')}` : ''}`

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
                          {t(group.label)} <strong style={{ fontWeight: 700 }}>({group.rows.length})</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {group.rows.map((r) => (
                            <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                              <span>
                                {fmtDate(r.date)}
                                {compOffDates.has(r.date) ? ` (${t('comp off')})` : ''}
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
                      {t('Holidays')} <strong style={{ fontWeight: 700 }}>({monthHolidays.length})</strong>
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
              {(leaveRecordsByStaff.get(openLeaveDatesStaffId) ?? []).length === 0 &&
                (holidays ?? []).filter((h) => h.date.startsWith(monthPrefix)).length === 0 && (
                  <div className="note">{t('Nothing recorded this month.')}</div>
                )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="pay-btn"
              style={kpiPeriod === p ? { background: 'var(--accent)', color: '#fff' } : undefined}
              onClick={() => setKpiPeriod(p)}
            >
              {p === 'week' ? t('This week') : p === 'month' ? t('This month') : t('Custom')}
            </button>
          ))}
        </div>
        {kpiPeriod === 'custom' && (
          <>
            <div className="field field-narrow">
              <label>{t('From')}</label>
              <input type="date" value={kpiCustomFrom} onChange={(e) => setKpiCustomFrom(e.target.value)} />
            </div>
            <div className="field field-narrow">
              <label>{t('To')}</label>
              <input type="date" value={kpiCustomTo} onChange={(e) => setKpiCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </div>
      {kpiRangeInvalid && (
        <div className="note" style={{ color: 'var(--red)' }}>
          "{t('From')}" {t('must be on or before')} "{t('To')}".
        </div>
      )}

      <div className="dash-grid" style={{ marginTop: 12 }}>
        <KpiCard
          label={t('Claims (Pending)')}
          value={fmt(myPendingTotal)}
          onClick={() => toggleKpi('claims')}
          active={expandedKpi === 'claims'}
        />
        <KpiCard
          label={t('Payments received')}
          value={fmt(myAdvancesTotal)}
          onClick={() => toggleKpi('payments')}
          active={expandedKpi === 'payments'}
        />
      </div>

      {expandedKpi === 'claims' && (
        <div style={{ marginTop: 16 }}>
          {pendingDates.length === 0 && <div className="note">{t('Nothing awaiting approval.')}</div>}
          {pendingDates.map((d, i) => {
            const dayExpenses = pendingByDate.get(d)!
            const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
            return (
              <details key={d} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>
                  {fmtDate(d)} — {fmt(dayTotal)}
                </summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Category')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map((e) => (
                        <tr key={e.id}>
                          <td>{t(categoryName(e.sub_head_id))}</td>
                          <td className="amt">{fmt(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      )}

      {expandedKpi === 'payments' && (
        <div style={{ marginTop: 16 }}>
          {advanceDates.length === 0 && <div className="note">{t('No Site Imprest payments received yet.')}</div>}
          {advanceDates.map((d, i) => {
            const dayAdvances = advancesByDate.get(d)!
            const dayTotal = dayAdvances.reduce((s, t) => s + Number(t.amount || 0), 0)
            return (
              <details key={d} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>
                  {fmtDate(d)} — {fmt(dayTotal)}
                </summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Remarks')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayAdvances.map((row) => (
                        <tr key={row.id}>
                          <td>{row.remarks || '—'}</td>
                          <td className="amt">{fmt(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
