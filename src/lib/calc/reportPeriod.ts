// Date-range presets for the Reports tab. Deliberately separate from
// lib/calc/period.ts (used by Expenses/Invoices/etc.) because "quarter" and
// "year" mean something different here — Financial Year (Apr 1–Mar 31) and
// FY-aligned quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar), not calendar
// ones. Reusing the same type names across both would be confusing.

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
  if (range.from && range.to) return `${range.from} to ${range.to}`
  if (range.from) return `From ${range.from}`
  return `Up to ${range.to}`
}
