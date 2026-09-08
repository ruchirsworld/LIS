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

// Reads a Date object's own calendar fields rather than .toISOString() —
// the xlsx/exceljs libraries (and Excel/LibreOffice's own auto-conversion
// of a typed date) don't consistently construct date cells at UTC
// midnight; some paths build them at *local* midnight instead. For anyone
// in a timezone ahead of UTC (e.g. IST, +5:30) that's the difference
// between "correct" and "one day earlier", since local-midnight-Aug-15
// becomes Aug-14-18:30 in UTC. Local getters are correct in either case —
// they're a no-op for a UTC-midnight Date (unaffected here) and exactly
// right for a local-midnight one, so there's no tradeoff to prefer
// .toISOString() over this.
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Every import template asks for DD-MM-YYYY, so that's parsed explicitly
// rather than falling through to the native Date constructor — which reads
// an ambiguous "05-08-2026" as MM-DD-YYYY (US-locale) and would silently
// swap day and month. A real Excel date cell (cellDates: true) or an
// already-ISO string still short-circuits above/below this, unaffected.
export function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return localDateStr(v)
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
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : localDateStr(d)
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
