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

export function KpiCard({
  label,
  value,
  onClick,
  active,
}: {
  label: string
  value: ReactNode
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div
      className={onClick ? 'dash-card dash-card-clickable' : 'dash-card'}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={active ? { borderColor: 'var(--accent)' } : undefined}
    >
      <div className="dash-label">
        {label}
        {onClick && <span className="dash-card-caret">{active ? '−' : '+'}</span>}
      </div>
      <div className="dash-value">{value}</div>
    </div>
  )
}
