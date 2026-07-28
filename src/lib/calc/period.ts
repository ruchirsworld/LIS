// Ported 1:1 from LIS_v1.0.html — the Month/Quarter/Year/All-time filter used
// on Invoices, Vendor Bills, Expenses, Loans, Capital, Attendance, Team
// Tracker, plus the Reports tab's custom range.

export type PeriodFilterType = 'all' | 'month' | 'quarter' | 'year' | 'custom'

export interface DateRange {
  from: string | null
  to: string | null
}

export function inRange(dateStr: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!dateStr) return !from && !to
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  return true
}

/** month is 'YYYY-MM' (as from an <input type="month">), quarter is 1-4. */
export function periodToRange(
  type: PeriodFilterType,
  opts: { month?: string; year?: string | number; quarter?: number; from?: string; to?: string }
): DateRange | null {
  if (type === 'month') {
    if (!opts.month) return null
    const [y, mo] = opts.month.split('-')
    const lastDay = new Date(Number(y), Number(mo), 0).getDate()
    return { from: `${opts.month}-01`, to: `${opts.month}-${String(lastDay).padStart(2, '0')}` }
  }
  if (type === 'quarter') {
    if (!opts.year || !opts.quarter) return null
    const y = Number(opts.year)
    const sm = (opts.quarter - 1) * 3 + 1
    const em = sm + 2
    const lastDay = new Date(y, em, 0).getDate()
    return {
      from: `${y}-${String(sm).padStart(2, '0')}-01`,
      to: `${y}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }
  if (type === 'year') {
    if (!opts.year) return null
    return { from: `${opts.year}-01-01`, to: `${opts.year}-12-31` }
  }
  if (type === 'custom') {
    return opts.from || opts.to ? { from: opts.from ?? null, to: opts.to ?? null } : null
  }
  return null
}
