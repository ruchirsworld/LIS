import { useEffect, useState } from 'react'
import { PeriodFilter } from './PeriodFilter'
import type { DateRange } from '../lib/calc/period'

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}

/** Calendar button that reveals the date filter on its own row — the same
 * control on every records list that has one (Expenses, Trips…). The filter
 * stays mounted while hidden so its picked values survive closing it. Render
 * inside a wrapping flex row. */
export function PeriodFilterToggle({
  range,
  onChange,
  preset,
}: {
  range: DateRange | null
  onChange: (range: DateRange | null) => void
  preset?: { from: string; to: string; nonce: number }
}) {
  const [open, setOpen] = useState(false)
  // A preset range is shown, not silently applied behind a closed panel.
  const presetNonce = preset?.nonce
  useEffect(() => {
    if (preset) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNonce])
  return (
    <>
      <button
        type="button"
        className={range ? 'icon-btn active' : 'icon-btn'}
        onClick={() => setOpen((v) => !v)}
        title="Filter by date"
        aria-label="Filter by date"
      >
        <CalendarIcon />
      </button>
      <div style={{ display: open ? 'block' : 'none', width: '100%', order: 99 }}>
        <PeriodFilter onChange={onChange} allowCustom style={{ marginBottom: 0 }} preset={preset} />
      </div>
    </>
  )
}
