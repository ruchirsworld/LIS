import { fmtDate } from '../lib/calc/format'

/** A search box above a list of records. Typing narrows the list to rows that contain every word typed. */
export function TableSearch({
  value,
  onChange,
  placeholder = 'Search by ID, description, name or amount…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="table-search">
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Search these records" />
      {value && (
        <button type="button" className="table-search-clear" onClick={() => onChange('')} aria-label="Clear search">
          ×
        </button>
      )}
    </div>
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

/** Turns one value of a row into searchable text: dates in both written and ISO form, amounts with and without commas. */
function textOf(part: unknown): string {
  if (part === null || part === undefined || part === '') return ''
  if (typeof part === 'number') return Number.isFinite(part) ? `${part} ${part.toFixed(2)}` : ''
  if (typeof part === 'boolean') return part ? 'yes' : ''
  const s = String(part)
  return ISO_DATE.test(s) ? `${s} ${fmtDate(s)}` : s
}

/** True when the row's text contains every word of the query (any order, any case). Amounts match with or without commas
 * or the rupee sign. An empty query matches everything. */
export function matchesSearch(query: string, parts: unknown[]): boolean {
  const words = query.toLowerCase().replace(/[₹,]/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = parts.map(textOf).join(' ').toLowerCase().replace(/,/g, '')
  return words.every((w) => text.includes(w))
}
