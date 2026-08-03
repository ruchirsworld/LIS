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

export function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = str(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
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
