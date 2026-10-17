import { useContext, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, CircleAlert, CircleCheck, Clock, Info, type LucideIcon } from 'lucide-react'
import { ShellTitleContext } from './PageHeader'
import './ui.css'

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'cta' | 'danger' | 'link' }) {
  const cls = variant === 'primary' ? 'btn' : `btn ${variant}`
  return <button className={[cls, className].filter(Boolean).join(' ')} {...rest} />
}

/** The green page title band. `actions` puts controls (a section switcher,
 * a mode toggle) on its right — the same layout on every page that has one. */
export function ModuleHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  // The app shell already shows the page title (and breadcrumbs and sub-tabs) above the page, so here only the page's own controls remain.
  const shellDrawsTitle = useContext(ShellTitleContext)
  if (shellDrawsTitle) return actions ? <div className="module-actions">{actions}</div> : null
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

export type StatusKind = 'success' | 'pending' | 'error' | 'info'

const STATUS_ICON: Record<StatusKind, LucideIcon> = { success: CircleCheck, pending: Clock, error: CircleAlert, info: Info }

/** A status label. Status colour is always paired with an icon and words, never colour alone. */
export function StatusTag({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  const Icon = STATUS_ICON[kind]
  return (
    <span className={`tag tag-${kind}`}>
      <Icon size={13} aria-hidden="true" />
      {children}
    </span>
  )
}

export type CostCentreKind = 'admin' | 'project' | 'trip'

const COST_CENTRE_LABEL: Record<CostCentreKind, string> = { admin: 'Admin', project: 'Project', trip: 'Trip' }

/** The cost-centre tag: Admin purple, Project teal, Trip blue-grey. These never reuse a status colour. */
export function CostCentreTag({ kind }: { kind: CostCentreKind }) {
  return <span className={`tag tag-cc-${kind}`}>{COST_CENTRE_LABEL[kind]}</span>
}

/** Maps the stored cost-centre text ('Admin', 'Trips', 'Project', in any case) to a tag kind. */
export function costCentreKind(value: string | null | undefined): CostCentreKind | null {
  const v = (value ?? '').trim().toLowerCase()
  if (v.startsWith('admin')) return 'admin'
  if (v.startsWith('trip')) return 'trip'
  if (v.startsWith('project')) return 'project'
  return null
}

/** Up to two initials from a name: "Ruchir Jain" gives RJ. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** A small round badge with a person's initials. `done` greys it with a tick, e.g. a reimbursement that has been paid. */
export function InitialsBadge({ name, done, title }: { name: string | null | undefined; done?: boolean; title?: string }) {
  return (
    <span className={done ? 'initials initials-done' : 'initials'} title={title ?? name ?? undefined}>
      {initialsOf(name)}
      {done && <Check size={10} strokeWidth={3} aria-label="Reimbursed" className="initials-tick" />}
    </span>
  )
}

/** What a list or panel shows when there is nothing to show yet, with a hint and, if useful, the next step. */
export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={28} aria-hidden="true" className="empty-state-icon" />}
      <div className="empty-state-title">{title}</div>
      {children && <div className="empty-state-text">{children}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}

/** A grey shimmering placeholder while data loads. `lines` stacks that many text-height bars. */
export function Skeleton({ lines = 1, height = 14 }: { lines?: number; height?: number }) {
  return (
    <div className="skeleton-stack" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" style={{ height, width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

/** Skeleton rows for a table that is loading. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="table-skeleton-row" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, c) => (
            <span key={c} className="skeleton" style={{ height: 14 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
