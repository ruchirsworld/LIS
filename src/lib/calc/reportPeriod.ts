// Date-range presets for the Reports tab. Deliberately separate from
// lib/calc/period.ts (used by Expenses/Invoices/etc.) because "quarter" and
// "year" mean something different here — Financial Year (Apr 1–Mar 31) and
// FY-aligned quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar), not calendar
// ones. Reusing the same type names across both would be confusing.

import { fmtDate } from './format'

export type ReportPeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

export interface DateRange {
  from: string | null
  to: string | null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** FY quarter index (0-3) for a given 0-based calendar month: Apr-Jun=0, Jul-Sep=1, Oct-Dec=2, Jan-Mar=3. */
function fyQuarterIndex(calMonth: number): number {
  return Math.floor(((calMonth + 9) % 12) / 3)
}

export function reportPeriodToRange(type: ReportPeriodType, opts: { from?: string; to?: string } = {}): DateRange | null {
  const now = new Date()

  if (type === 'today') {
    const s = toISO(now)
    return { from: s, to: s }
  }

  if (type === 'week') {
    // Monday-start week.
    const day = now.getDay() // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: toISO(monday), to: toISO(sunday) }
  }

  if (type === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: toISO(first), to: toISO(last) }
  }

  if (type === 'quarter') {
    const m = now.getMonth()
    const qIndex = fyQuarterIndex(m)
    const startCalMonth = (qIndex * 3 + 3) % 12 // 0-based calendar month the quarter starts in
    const fyStartYear = m >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const startYear = startCalMonth < 3 ? fyStartYear + 1 : fyStartYear
    const first = new Date(startYear, startCalMonth, 1)
    const last = new Date(startYear, startCalMonth + 3, 0)
    return { from: toISO(first), to: toISO(last) }
  }

  if (type === 'year') {
    const m = now.getMonth()
    const fyStartYear = m >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const first = new Date(fyStartYear, 3, 1)
    const last = new Date(fyStartYear + 1, 2, 31)
    return { from: toISO(first), to: toISO(last) }
  }

  if (type === 'custom') {
    return opts.from || opts.to ? { from: opts.from ?? null, to: opts.to ?? null } : null
  }

  return null
}

/** Human-readable label for a range, used on exported PDF/Excel reports. */
export function formatRangeLabel(range: DateRange | null): string {
  if (!range || (!range.from && !range.to)) return 'All time'
  if (range.from && range.to) return `${fmtDate(range.from)} to ${fmtDate(range.to)}`
  if (range.from) return `From ${fmtDate(range.from)}`
  return `Up to ${fmtDate(range.to)}`
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + days))
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  // Keep the day when it exists in the target month, else clamp to its last day.
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return toISO(target)
}

function daysBetween(fromISO: string, toISO_: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO_.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

/** The period immediately before `range`, for "vs last period" comparisons:
 * the previous month/quarter/year/week/day for a preset, or the same number
 * of days straight before a custom range. Null when there is nothing to
 * compare against (all time, or an open-ended custom range). */
export function previousRange(range: DateRange | null, type: ReportPeriodType): DateRange | null {
  if (!range?.from || !range.to) return null
  const { from, to } = range
  if (type === 'today') return { from: addDaysISO(from, -1), to: addDaysISO(to, -1) }
  if (type === 'week') return { from: addDaysISO(from, -7), to: addDaysISO(to, -7) }
  if (type === 'month') {
    const prevFrom = addMonthsISO(from, -1)
    return { from: prevFrom, to: addDaysISO(from, -1) }
  }
  if (type === 'quarter') return { from: addMonthsISO(from, -3), to: addDaysISO(from, -1) }
  if (type === 'year') return { from: addMonthsISO(from, -12), to: addDaysISO(from, -1) }
  if (type === 'custom') {
    const length = daysBetween(from, to) + 1
    return { from: addDaysISO(from, -length), to: addDaysISO(from, -1) }
  }
  return null
}

/** Label for the comparison, e.g. "last month". */
export function previousPeriodLabel(type: ReportPeriodType): string {
  switch (type) {
    case 'today':
      return 'yesterday'
    case 'week':
      return 'last week'
    case 'month':
      return 'last month'
    case 'quarter':
      return 'last quarter'
    case 'year':
      return 'last year'
    default:
      return 'previous period'
  }
}
