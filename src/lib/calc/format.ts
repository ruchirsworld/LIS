// Ported 1:1 from LIS_v1.0.html — Indian digit grouping (e.g. 12,50,000) for
// currency inputs, plus the display/parse helpers used everywhere else.

export function fmt(n: number | string | null | undefined): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
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

/** Displays a stored YYYY-MM-DD (or YYYY-MM-DDThh:mm:ss) date as DD-MM-YYYY.
 * Storage/inputs stay ISO — this is display-only, applied wherever a raw
 * date is shown in a table. Falls back to the original string if it isn't
 * in the expected shape. */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const s = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return dateStr
  const [, y, m, d] = match
  return `${d}-${m}-${y}`
}
