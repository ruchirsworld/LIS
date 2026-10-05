// Ported 1:1 from LIS_v1.0.html — Indian digit grouping (e.g. 12,50,000) for
// currency inputs, plus the display/parse helpers used everywhere else.

export function fmt(n: number | string | null | undefined): string {
  const num = Number(n || 0)
  const sign = num < 0 ? '-' : ''
  return sign + '₹' + Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function fmtPlain(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/** Live-formats a currency input's raw value with Indian comma grouping as the user types. */
export function formatINR(raw: string): string {
  raw = String(raw).replace(/[^0-9.]/g, '')
  const firstDot = raw.indexOf('.')
  if (firstDot !== -1) {
    raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '')
  }
  let [intPart, dec] = raw.split('.')
  intPart = (intPart || '').replace(/^0+(?=\d)/, '')
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    intPart = rest + ',' + last3
  }
  return intPart + (dec !== undefined ? '.' + dec.slice(0, 2) : '')
}

/** Parses a formatted (comma-grouped) currency string back to a plain number. */
export function parseINR(value: string | null | undefined): number {
  return Number(String(value || '0').replace(/,/g, '')) || 0
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Displays a stored YYYY-MM-DD (or YYYY-MM-DDThh:mm:ss) date as DD MMM YYYY
 * (e.g. 31 Aug 2026). Storage/inputs stay ISO — this is display-only,
 * applied wherever a raw date is shown in a table. Falls back to the
 * original string if it isn't in the expected shape. */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const s = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return dateStr
  const [, y, m, d] = match
  const month = MONTH_ABBR[Number(m) - 1]
  if (!month) return dateStr
  return `${d} ${month} ${y}`
}

/** Short rupee figure for chart labels where space is tight: ₹1.2Cr, ₹3.4L, ₹56K. */
export function fmtCompact(n: number | string | null | undefined): string {
  const num = Number(n || 0)
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(num)
  const trim = (v: number) => String(Math.round(v * 10) / 10)
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`
  return `${sign}₹${Math.round(abs)}`
}
