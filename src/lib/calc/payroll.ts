// Day-by-day wage accrual — mirrors LIS_Fields' lib/payroll.ts (the
// field-worker app's proven payroll model), adapted for ERP2.0's Staff
// (no per-site allowance concept here, so that piece is dropped).

// Only the first 4 Absent days in a calendar month are full-pay (treated as
// Leave); any beyond that in the same month lose pay for that day.
const FREE_LEAVES_PER_MONTH = 4

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Stay entirely in UTC-space: parsing "YYYY-MM-DD" without a timezone
// suffix treats it as local midnight, and toISOString() converts that to
// UTC — in a timezone ahead of UTC (e.g. IST) that silently shifts every
// date back a day. Parsing with an explicit "Z" and stepping via
// setUTCDate keeps the whole loop timezone-agnostic.
export function isoDatesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export type AttendanceDayType = 'leave' | 'absent' | 'half_day'

export const ATTENDANCE_DAY_TYPE_LABEL: Record<AttendanceDayType, string> = {
  leave: 'Leave',
  absent: 'Absent',
  half_day: 'Half day',
}

export interface AttendanceDay {
  date: string
  day_type: AttendanceDayType
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// How many of a calendar month's days actually fall within employment —
// a full month scores every day; a mid-month join or exit scores only the
// days on the job, so the monthly quota below can be pro-rated to match.
function employedDaysInMonth(month: string, startDate: string, endDate: string | null): number {
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  const empStart = startDate > monthStart ? startDate : monthStart
  const empEnd = endDate && endDate < monthEnd ? endDate : monthEnd
  if (empStart > empEnd) return 0
  return isoDatesBetween(empStart, empEnd).length
}

export interface FreeLeaveQuota {
  /** The base free-leave quota for this staff member's month — the flat
   * FREE_LEAVES_PER_MONTH for a full month, scaled down for a mid-month
   * join/exit. Doesn't include any compensatory-leave bonus. */
  quota: number
  /** True when a mid-month join or exit actually scaled the quota down —
   * i.e. this staff member wasn't employed for the whole month. */
  isProRated: boolean
}

// Single source of truth for "how many free Absent/Leave days does this
// staff member get this month" — used both by the payroll accrual itself
// (quotaForMonth below, plus any compensatory-leave bonus) and by the
// Attendance page's leave breakdown, so the two never disagree about the
// quota shown vs. the quota actually paid.
export function freeLeaveQuotaInfo(staff: { start_date: string; end_date: string | null }, month: string): FreeLeaveQuota {
  const totalDays = daysInMonth(month)
  const employedDays = employedDaysInMonth(month, staff.start_date, staff.end_date)
  const quota = Math.round((FREE_LEAVES_PER_MONTH * employedDays) / totalDays)
  return { quota, isProRated: employedDays < totalDays }
}

// `quotaForMonth` gives the number of free days for a given "YYYY-MM" —
// normally the pro-rated FREE_LEAVES_PER_MONTH (full for a full month, less
// for a mid-month join/exit) plus any compensatory leave earned that month.
export function leaveFreeDates(leaveDates: string[], quotaForMonth: (month: string) => number = () => FREE_LEAVES_PER_MONTH): Set<string> {
  const byMonth = new Map<string, string[]>()
  for (const d of leaveDates) {
    const month = d.slice(0, 7)
    const list = byMonth.get(month) ?? []
    list.push(d)
    byMonth.set(month, list)
  }
  const free = new Set<string>()
  for (const [month, dates] of byMonth.entries()) {
    dates.sort()
    const cap = quotaForMonth(month)
    for (const d of dates.slice(0, cap)) free.add(d)
  }
  return free
}

export interface AccrualStaff {
  daily_rate: number
  start_date: string
  end_date: string | null
}

// Every day in [start_date, end_date ?? today] is Present (full pay) by
// default, except:
//   - a defined Holiday — always full pay, regardless of any attendance record
//   - an 'absent' day — full pay only if it's among the first N Absent days
//     that calendar month (those first N count as Leave), 0 pay beyond that.
//     N is FREE_LEAVES_PER_MONTH pro-rated to however many of that month's
//     days actually fall within employment (a mid-month join or exit gets a
//     smaller quota, not the full month's worth) — plus one more per
//     Holiday actually worked that month (see `workedHolidayDates`), as
//     compensatory leave
//   - a legacy 'leave' day — kept for old records, competes for the same
//     monthly quota as 'absent' (the marking UI no longer distinguishes them)
//   - a 'half_day' — always half pay, independent of the Absent/Leave quota
// `allAttendanceDays` should be the staff member's *full* attendance
// history, even when only summing a narrower [rangeStart, rangeEnd] window —
// the monthly free-day cap needs the whole month's record to decide which
// days were free, not just the ones inside the window. `workedHolidayDates`
// should likewise cover the whole history, not just the window.
export interface AccrualBreakdown {
  /** Every day in the clamped [start, end] window, regardless of type. */
  totalDays: number
  /** Worked normally, no exception recorded — full pay. */
  presentDays: number
  /** Absent/Leave days that landed inside that month's quota — full pay. */
  paidOffDays: number
  /** Absent/Leave days beyond the quota — unpaid. */
  unpaidOffDays: number
  /** Half-day markings — half pay, outside the quota entirely. */
  halfDays: number
  /** Defined Holidays in range — always full pay. */
  holidayDays: number
  /** The resulting wage total — same value computeAccrued returns. */
  amount: number
}

// Same day-by-day model as computeAccrued (see below) but returns the full
// per-category breakdown instead of just the final total — for showing a
// worker's leave/present/holiday counts wherever the raw number needs
// explaining, e.g. the payroll confirmation dialog.
export function computeAccrualBreakdown(
  staff: AccrualStaff,
  allAttendanceDays: AttendanceDay[],
  holidayDates: Set<string>,
  rangeStart: string,
  rangeEnd: string,
  workedHolidayDates: string[] = []
): AccrualBreakdown {
  const today = todayStr()
  const employmentEnd = staff.end_date && staff.end_date < today ? staff.end_date : today
  const start = rangeStart > staff.start_date ? rangeStart : staff.start_date
  const end = rangeEnd < employmentEnd ? rangeEnd : employmentEnd
  if (start > end) {
    return { totalDays: 0, presentDays: 0, paidOffDays: 0, unpaidOffDays: 0, halfDays: 0, holidayDays: 0, amount: 0 }
  }

  // A date that's already a Holiday pays in full regardless of any marking
  // on it (see the loop below), so it must not compete for a free-quota
  // slot — otherwise it silently steals a slot from a real absence later
  // that month without changing anyone's pay for the Holiday itself.
  const offDates = allAttendanceDays
    .filter((a) => (a.day_type === 'absent' || a.day_type === 'leave') && !holidayDates.has(a.date))
    .map((a) => a.date)
  const offSet = new Set(offDates)
  const compBonusByMonth = new Map<string, number>()
  for (const d of workedHolidayDates) {
    if (!holidayDates.has(d)) continue
    const month = d.slice(0, 7)
    compBonusByMonth.set(month, (compBonusByMonth.get(month) ?? 0) + 1)
  }
  const quotaForMonth = (month: string) => {
    return freeLeaveQuotaInfo(staff, month).quota + (compBonusByMonth.get(month) ?? 0)
  }
  const freeOffDates = leaveFreeDates(offDates, quotaForMonth)
  const halfDaySet = new Set(allAttendanceDays.filter((a) => a.day_type === 'half_day').map((a) => a.date))

  let amount = 0
  let presentDays = 0
  let paidOffDays = 0
  let unpaidOffDays = 0
  let halfDays = 0
  let holidayDays = 0
  const dates = isoDatesBetween(start, end)
  for (const date of dates) {
    if (holidayDates.has(date)) {
      amount += staff.daily_rate
      holidayDays++
    } else if (halfDaySet.has(date)) {
      amount += staff.daily_rate * 0.5
      halfDays++
    } else if (offSet.has(date)) {
      if (freeOffDates.has(date)) {
        amount += staff.daily_rate
        paidOffDays++
      } else {
        unpaidOffDays++
      }
    } else {
      amount += staff.daily_rate
      presentDays++
    }
  }
  return { totalDays: dates.length, presentDays, paidOffDays, unpaidOffDays, halfDays, holidayDays, amount }
}

export function computeAccrued(
  staff: AccrualStaff,
  allAttendanceDays: AttendanceDay[],
  holidayDates: Set<string>,
  rangeStart: string,
  rangeEnd: string,
  workedHolidayDates: string[] = []
): number {
  return computeAccrualBreakdown(staff, allAttendanceDays, holidayDates, rangeStart, rangeEnd, workedHolidayDates).amount
}

// One day after the most recent accrual's period_end, so a new payroll run
// picks up exactly where the last one left off — falls back to the staff
// member's start date if nothing's been accrued yet.
export function nextAccrualStart(staff: { start_date: string }, priorPeriodEnds: string[]): string {
  if (priorPeriodEnds.length === 0) return staff.start_date
  const latest = priorPeriodEnds.reduce((a, b) => (a > b ? a : b))
  const next = new Date(`${latest}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}
