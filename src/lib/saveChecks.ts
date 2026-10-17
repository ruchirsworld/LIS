// The checks every entry form runs before it saves: warnings about the date and the amount, and the rule for what counts as a
// possible duplicate. Plain functions, so they can be tested without a screen or a database.

export interface SaveWarning {
  kind: 'future-date' | 'old-date' | 'large-amount'
  message: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

/** Warns about a date in the future, or one more than 30 days back. Neither blocks saving. */
export function dateWarnings(date: string, today: string): SaveWarning[] {
  const ahead = daysBetween(today, date)
  if (ahead > 0) return [{ kind: 'future-date', message: `This date is ${ahead} day${ahead === 1 ? '' : 's'} in the future.` }]
  const behind = -ahead
  if (behind > 30) return [{ kind: 'old-date', message: `This date is ${behind} days ago. Check it is not a typing slip.` }]
  return []
}

/** Warns when an amount is far above what is usual for its category: at least three times the average of earlier entries (needs five or more). */
export function amountWarning(amount: number, earlier: number[]): SaveWarning[] {
  const usable = earlier.filter((n) => Number.isFinite(n) && n > 0)
  if (usable.length < 5) return []
  const average = usable.reduce((s, n) => s + n, 0) / usable.length
  if (amount >= average * 3) {
    return [{ kind: 'large-amount', message: `This is about ${(amount / average).toFixed(1)} times the usual amount for this category. Check the digits.` }]
  }
  return []
}

/** The dates to search for a duplicate: two days either side of the entry's date. */
export function duplicateWindow(date: string): { from: string; to: string } {
  const base = dayNumber(date)
  const iso = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10)
  return { from: iso(base - 2), to: iso(base + 2) }
}

export interface DuplicateMatch {
  module: string
  displayId: string | null
  date: string
  amount: number
  enteredBy: string | null
}

/** One sentence the person reads before saving, e.g. "Expense ₹5,000 · 15 Oct · Project: Garden". */
export function entrySentence(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ')
}
