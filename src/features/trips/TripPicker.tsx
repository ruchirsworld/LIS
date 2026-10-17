import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { fmtDate } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type TripRow = Database['public']['Tables']['trips']['Row']

const monthLabel = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

/** A searchable list of trips, active and closed, grouped by the month they started (newest first), each with an Active or Closed tag. */
export function TripPicker({
  trips,
  value,
  onChange,
  travellerName,
}: {
  trips: TripRow[]
  value: string | null
  onChange: (id: string) => void
  travellerName: (id: string | null) => string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = trips.find((t) => t.id === value) ?? null

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const hit = (t: TripRow) => {
      const text = `${t.display_id ?? ''} ${t.name} ${travellerName(t.traveler_id)} ${t.status === 'open' ? 'active' : 'closed'} ${fmtDate(t.start_date)}`.toLowerCase()
      return words.every((w) => text.includes(w))
    }
    const byMonth = new Map<string, TripRow[]>()
    for (const t of [...trips].sort((a, b) => b.start_date.localeCompare(a.start_date)).filter(hit)) {
      const key = t.start_date.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), t])
    }
    return [...byMonth.entries()]
  }, [trips, query, travellerName])

  return (
    <div className="trip-picker" ref={rootRef}>
      <button type="button" className="trip-picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {selected ? (
          <>
            <span className="mono trip-picker-id">{selected.display_id}</span>
            <span className="trip-picker-name">{selected.name}</span>
            <span className={selected.status === 'open' ? 'tag tag-success' : 'tag'}>{selected.status === 'open' ? 'Active' : 'Closed'}</span>
          </>
        ) : (
          <span className="trip-picker-placeholder">Choose a trip…</span>
        )}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="trip-picker-pop">
          <div className="trip-picker-search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by ID, name or traveller" aria-label="Search trips" />
          </div>
          <div className="trip-picker-list" role="listbox">
            {groups.length === 0 && <div className="trip-picker-empty">No trip matches.</div>}
            {groups.map(([month, list]) => (
              <div key={month}>
                <div className="trip-picker-month">{monthLabel(month)}</div>
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={t.id === value}
                    className={t.id === value ? 'trip-picker-item active' : 'trip-picker-item'}
                    onClick={() => {
                      onChange(t.id)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <span className="mono trip-picker-id">{t.display_id}</span>
                    <span className="trip-picker-name">{t.name}</span>
                    <span className="trip-picker-dates">
                      {fmtDate(t.start_date)}
                      {t.end_date ? ` – ${fmtDate(t.end_date)}` : ' – ongoing'}
                    </span>
                    <span className={t.status === 'open' ? 'tag tag-success' : 'tag'}>{t.status === 'open' ? 'Active' : 'Closed'}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
