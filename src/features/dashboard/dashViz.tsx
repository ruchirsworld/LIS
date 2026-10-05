import { fmt, fmtCompact } from '../../lib/calc/format'

/** Last-N-days trend as a small filled line. Scales to its container; the
 * end dot is a separate element so it stays round when the line stretches. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * 100
  const y = (v: number) => 30 - ((v - min) / span) * 26 - 2
  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`)
  const lastY = (y(values[values.length - 1]) / 30) * 100
  return (
    <div style={{ position: 'relative' }}>
      <svg className="dash-spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
        <polygon className="dash-spark-area" points={`0,30 ${points.join(' ')} 100,30`} />
        <polyline className="dash-spark-line" points={points.join(' ')} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="dash-spark-dot-el" style={{ top: `calc(${lastY}% - 3px)` }} aria-hidden="true" />
    </div>
  )
}

/** "▲ 12% vs last month". goodWhen says which direction is good news, so a
 * rise in revenue reads green and a rise in expenses reads red. */
export function Delta({
  current,
  previous,
  goodWhen,
  label,
}: {
  current: number
  previous: number | undefined
  goodWhen: 'up' | 'down' | 'neutral'
  label: string
}) {
  if (previous === undefined) return null
  if (Math.abs(previous) < 0.5) {
    return <div className="dash-delta">{Math.abs(current) < 0.5 ? `Same as ${label}` : `New — nothing ${label}`}</div>
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(pct) < 0.5) return <div className="dash-delta">No change vs {label}</div>
  const up = pct > 0
  const good = goodWhen === 'neutral' ? null : goodWhen === 'up' ? up : !up
  const cls = good === null ? 'dash-delta' : good ? 'dash-delta dash-delta-good' : 'dash-delta dash-delta-bad'
  return (
    <div className={cls} title={`${label}: ${fmt(previous)}`}>
      {up ? '▲' : '▼'} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}% vs {label}
    </div>
  )
}

/** Thin share-of-total bar, e.g. how much of what clients owe is overdue. */
export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  if (total <= 0) return null
  const pct = Math.min(100, Math.max(0, (value / total) * 100))
  return (
    <div>
      <div className="dash-progress" role="img" aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="dash-progress-label">{label}</div>
    </div>
  )
}

export interface BarItem {
  key: string
  label: string
  value: number
  tone?: 'default' | 'warn' | 'danger'
  detail?: string
}

/** Horizontal bars, one tappable row each. Picking a row marks it selected so
 * the table under the chart can narrow to it. */
export function HBarChart({
  items,
  selectedKey,
  onSelect,
  empty,
}: {
  items: BarItem[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  empty: string
}) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (items.length === 0 || max <= 0) return <div className="note">{empty}</div>
  return (
    <div className="dash-hbars" role="list">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="listitem"
          className={`dash-hbar${selectedKey === item.key ? ' selected' : ''}${item.tone ? ` tone-${item.tone}` : ''}`}
          aria-pressed={selectedKey === item.key}
          title={`${item.label}: ${fmt(item.value)}${item.detail ? ` — ${item.detail}` : ''}`}
          onClick={() => onSelect(selectedKey === item.key ? null : item.key)}
        >
          <span className="dash-hbar-label">{item.label}</span>
          <span className="dash-hbar-track">
            <span className="dash-hbar-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </span>
          <span className="dash-hbar-value">{fmtCompact(item.value)}</span>
        </button>
      ))}
    </div>
  )
}

export interface MonthPair {
  key: string
  label: string
  inflow: number
  outflow: number
}

/** Money in against money out per month — two bars per month, month tappable. */
export function MonthBars({
  months,
  selectedKey,
  onSelect,
}: {
  months: MonthPair[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
}) {
  const max = Math.max(...months.flatMap((m) => [m.inflow, m.outflow]), 0)
  if (max <= 0) return <div className="note">No receipts or spending recorded in these months.</div>
  return (
    <div>
      <div className="dash-months" role="list">
        {months.map((m) => (
          <button
            key={m.key}
            type="button"
            role="listitem"
            className={`dash-month${selectedKey === m.key ? ' selected' : ''}`}
            aria-pressed={selectedKey === m.key}
            title={`${m.label}: in ${fmt(m.inflow)}, out ${fmt(m.outflow)}`}
            onClick={() => onSelect(selectedKey === m.key ? null : m.key)}
          >
            <span className="dash-month-bars">
              <span className="dash-month-bar in" style={{ height: `${Math.max(m.inflow > 0 ? 3 : 0, (m.inflow / max) * 100)}%` }} />
              <span className="dash-month-bar out" style={{ height: `${Math.max(m.outflow > 0 ? 3 : 0, (m.outflow / max) * 100)}%` }} />
            </span>
            <span className="dash-month-label">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="dash-legend">
        <span>
          <i className="in" /> Received
        </span>
        <span>
          <i className="out" /> Spent
        </span>
      </div>
    </div>
  )
}
