import { useState, type CSSProperties } from 'react'
import type { DateRange, PeriodFilterType } from '../lib/calc/period'
import { periodToRange } from '../lib/calc/period'

interface PeriodFilterProps {
  onChange: (range: DateRange | null) => void
  allowCustom?: boolean
  style?: CSSProperties
}

/** Month/Quarter/Year/All-time filter, ported from the v1.0 prototype's per-tab filter row. */
export function PeriodFilter({ onChange, allowCustom = false, style }: PeriodFilterProps) {
  const [type, setType] = useState<PeriodFilterType>('all')
  const [month, setMonth] = useState('')
  const [quarter, setQuarter] = useState(1)
  const [year, setYear] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  function emit(next: {
    type?: PeriodFilterType
    month?: string
    quarter?: number
    year?: string
    from?: string
    to?: string
  }) {
    const t = next.type ?? type
    onChange(
      periodToRange(t, {
        month: next.month ?? month,
        quarter: next.quarter ?? quarter,
        year: next.year ?? year,
        from: next.from ?? from,
        to: next.to ?? to,
      })
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14, ...style }}>
      <div className="field" style={{ maxWidth: 130 }}>
        <label>Filter by</label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as PeriodFilterType
            setType(t)
            emit({ type: t })
          }}
        >
          <option value="all">All time</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
          {allowCustom && <option value="custom">Custom range</option>}
        </select>
      </div>

      {type === 'month' && (
        <div className="field" style={{ maxWidth: 160 }}>
          <label>Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              emit({ month: e.target.value })
            }}
          />
        </div>
      )}

      {type === 'quarter' && (
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Quarter</label>
          <select
            value={quarter}
            onChange={(e) => {
              const q = Number(e.target.value)
              setQuarter(q)
              emit({ quarter: q })
            }}
          >
            <option value={1}>Q1 (Jan-Mar)</option>
            <option value={2}>Q2 (Apr-Jun)</option>
            <option value={3}>Q3 (Jul-Sep)</option>
            <option value={4}>Q4 (Oct-Dec)</option>
          </select>
        </div>
      )}

      {(type === 'quarter' || type === 'year') && (
        <div className="field" style={{ maxWidth: 100 }}>
          <label>Year</label>
          <input
            type="number"
            placeholder="2026"
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              emit({ year: e.target.value })
            }}
          />
        </div>
      )}

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
