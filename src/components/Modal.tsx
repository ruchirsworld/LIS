import { useEffect, useRef, type ReactNode } from 'react'

/** Centered popup with a backdrop — closes on backdrop click or Escape.
 * Focus moves into the popup when it opens and returns to where it was on close. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)')
    ;(first ?? panelRef.current)?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>{title}</strong>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
