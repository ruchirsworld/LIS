// Shared cell-parsing helpers, reused across every import flow (the
// combined workbook and each standalone entity file) so behavior never
// drifts between them.

export function str(v: unknown): string {
  return String(v ?? '').trim()
}

export function num(v: unknown): number | null {
  const s = str(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Previously read a real Excel date cell via cellDates:true, which hands
// back a JS Date object — but on a machine running ahead of UTC (e.g. IST,
// +5:30) that Date is built close enough to the *local* midnight boundary
// that a ~10-second rounding quirk in the xlsx library's own date encoding
// tips it to the wrong side, landing one calendar day early once read back
// out (confirmed against the actual xlsx package, not just reasoned about).
// Every XLSX.read() call in this app's import parsers now passes
// cellDates:false instead, so a date cell's raw Excel serial number (an
// integer day count, no time-of-day, no timezone) reaches here directly —
// converted with the same epoch arithmetic the xlsx library uses
// internally (verified against XLSX.SSF.parse_date_code across 1900–2100),
// with no Date object and so no timezone step to get wrong.
function excelSerialToDateStr(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30)
  const d = new Date(epoch + Math.round(serial) * 86400000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Every import template asks for DD-MM-YYYY, so that's parsed explicitly
// rather than falling through to the native Date constructor — which reads
// an ambiguous "05-08-2026" as MM-DD-YYYY (US-locale) and would silently
// swap day and month. A real Excel date cell (now a plain number, see
// above) or an already-ISO string still short-circuits above/below this,
// unaffected.
export function toDateStr(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return excelSerialToDateStr(v)
  const s = str(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const ddmmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (ddmmyyyy) {
    const [, ddStr, mmStr, yyyyStr] = ddmmyyyy
    const dd = Number(ddStr)
    const mm = Number(mmStr)
    const yyyy = Number(yyyyStr)
    const d = new Date(Date.UTC(yyyy, mm - 1, dd))
    if (isNaN(d.getTime()) || d.getUTCDate() !== dd || d.getUTCMonth() !== mm - 1) return null
    return d.toISOString().slice(0, 10)
  }
  // Last resort for free-text formats (e.g. "Sep 15 2026") — the native
  // constructor and these local getters both run in the browser's own
  // timezone, so they agree with each other even though this path is
  // otherwise timezone-sensitive.
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => str(v) === '')
}

export function yesNo(v: unknown): boolean {
  return str(v).toLowerCase() === 'yes'
}

export function paymentModeOf(v: unknown): 'UPI' | 'Cash' | 'Bank' | null {
  const s = str(v)
  return s === 'UPI' || s === 'Cash' || s === 'Bank' ? s : null
}

/** Reads every row of one sheet in an already-parsed workbook as plain objects. */
export function sheetRowsOf(wb: import('xlsx').WorkBook, XLSX: typeof import('xlsx'), name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
}
