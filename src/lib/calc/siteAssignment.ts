// The site a staff member actually worked on a given date — single source
// of truth shared by TeamCalendarSection (what Admin/CXO sees on the team
// calendar) and project wage attribution (payroll cost by project, see
// projectWageTotal in projects.ts), so the two always agree on which
// project a given day's work belongs to.

export interface SiteAssignmentStaff {
  id: string
  default_project_id?: string | null
  start_date: string
  end_date?: string | null
}

export interface SiteAssignmentException {
  staff_id: string
  date: string
  day_type: string
}

// Absent/Leave always wins first — even if a site was pre-set (e.g. carried
// over from the day before) it wasn't actually worked if they didn't show
// up. Short of that, an explicit day-specific assignment wins (covers
// comp-off on a Holiday, or a future date someone's deliberately planned
// ahead for). Otherwise only fall back to their default project if the day
// could actually have been worked: on the roster yet (not before they
// joined or after they left), not in the future, and not a Holiday they sat
// out. A half day still counts as worked — they were still at the site for
// part of it.
export function resolveStaffSite(
  member: SiteAssignmentStaff,
  date: string,
  today: string,
  exceptionByStaffDate: Map<string, SiteAssignmentException>,
  assignmentByStaffDate: Map<string, string>,
  holidayDates: Set<string>
): string | null {
  const exception = exceptionByStaffDate.get(`${member.id}:${date}`)
  if (exception && (exception.day_type === 'absent' || exception.day_type === 'leave')) return null
  const override = assignmentByStaffDate.get(`${member.id}:${date}`)
  if (override) return override
  if (date < member.start_date) return null
  if (member.end_date && date > member.end_date) return null
  if (date > today) return null
  if (holidayDates.has(date)) return null
  return member.default_project_id ?? null
}
