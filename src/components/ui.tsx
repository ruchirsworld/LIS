import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'link' }) {
  const cls = variant === 'primary' ? 'btn' : variant === 'secondary' ? 'btn secondary' : 'btn link'
  return <button className={[cls, className].filter(Boolean).join(' ')} {...rest} />
}

/** The green page title band. `actions` puts controls (a section switcher,
 * a mode toggle) on its right — the same layout on every page that has one. */
export function ModuleHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  if (!actions) return <div className="module-header">{children}</div>
  return (
    <div className="module-header">
      <div className="module-header-row">
        <span className="module-header-title">{children}</span>
        <div className="module-header-actions">{actions}</div>
      </div>
    </div>
  )
}

export type KpiTone = 'danger' | 'warn' | 'good'

export function KpiCard({
  label,
  value,
  onClick,
  active,
  retention,
  tone,
  sub,
  go,
  hint,
  loading,
  extra,
}: {
  label: string
  value: ReactNode
  onClick?: () => void
  active?: boolean
  /** Blue treatment used for retention figures everywhere in the app. */
  retention?: boolean
  /** Status colour: danger = needs action now, warn = needs a look, good = all clear. */
  tone?: KpiTone
  /** Small line under the value, e.g. "All clear" or "₹2.4L overdue". */
  sub?: ReactNode
  /** The card opens another page rather than expanding in place (shows an arrow). */
  go?: boolean
  /** Hover tooltip. */
  hint?: string
  /** Show a shimmering placeholder in place of the value. */
  loading?: boolean
  /** Extra content under the value: a trend, sparkline or progress bar. */
  extra?: ReactNode
}) {
  const classes = ['dash-card']
  if (onClick) classes.push('dash-card-clickable')
  if (retention) classes.push('dash-card-retention')
  if (tone) classes.push(`dash-card-${tone}`)
  return (
    <div
      className={classes.join(' ')}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-expanded={onClick && !go ? !!active : undefined}
      title={hint}
      style={active ? { borderColor: 'var(--accent)' } : undefined}
    >
      <div className="dash-label">
        {label}
        {onClick && <span className="dash-card-caret">{go ? '→' : active ? '−' : '+'}</span>}
      </div>
      <div className="dash-value">{loading ? <span className="dash-skeleton" role="status" aria-label="Loading" /> : value}</div>
      {sub && !loading && <div className="dash-sub">{sub}</div>}
      {extra && !loading && <div className="dash-extra">{extra}</div>}
    </div>
  )
}
