import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** A compact panel that slides in from the right (a bottom sheet on a phone) for looking at or editing one record without leaving the list.
 * Closes with the X, Esc or a click outside. Focus moves in on open and returns to the row that opened it. `footer` is the fixed action bar. */
export function SidePanel({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div className="side-panel-backdrop" onClick={onClose}>
      <aside ref={panelRef} className="side-panel" tabIndex={-1} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-grip" aria-hidden="true" />
        <header className="side-panel-header">
          <div className="side-panel-title">{title}</div>
          <button type="button" className="side-panel-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="side-panel-body">{children}</div>
        {footer && <footer className="side-panel-footer">{footer}</footer>}
      </aside>
    </div>
  )
}

/** The tight two-column label / value grid used for the key facts of a record. */
export function FactGrid({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="fact-grid">
      {facts
        .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
        .map((f) => (
          <div key={f.label} className="fact">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
    </dl>
  )
}
