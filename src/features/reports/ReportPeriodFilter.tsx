import { useState } from 'react'
import type { DateRange, ReportPeriodType } from '../../lib/calc/reportPeriod'
import { reportPeriodToRange } from '../../lib/calc/reportPeriod'

interface ReportPeriodFilterProps {
  onChange: (range: DateRange | null, type: ReportPeriodType) => void
  /** Opens with this period instead of "This month". */
  initial?: { type: ReportPeriodType; from: string | null; to: string | null }
}

/** Today/This week/This month/This quarter/This year (FY)/All time/Custom range
 * filter shared by every section on the Reports tab. */
export function ReportPeriodFilter({ onChange, initial }: ReportPeriodFilterProps) {
  const [type, setType] = useState<ReportPeriodType>(initial?.type ?? 'month')
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')

  function emit(next: { type?: ReportPeriodType; from?: string; to?: string }) {
    const t = next.type ?? type
    onChange(reportPeriodToRange(t, { from: next.from ?? from, to: next.to ?? to }), t)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
      <div className="field" style={{ maxWidth: 160 }}>
        <label>Period</label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as ReportPeriodType
            setType(t)
            emit({ type: t })
          }}
        >
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="quarter">This quarter (FY)</option>
          <option value="year">This year (FY)</option>
          <option value="all">All time</option>
          <option value="custom">Custom range</option>
        </select>
      </div>

      {type === 'custom' && (
        <>
          <div className="field">
            <label>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                emit({ from: e.target.value })
              }}
            />
          </div>
          <div className="field">
            <label>To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                emit({ to: e.target.value })
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
