import { useState, type ReactNode } from 'react'

const STORAGE_KEY = 'lis.dash.sections'

export type DashSectionId = 'attention' | 'position' | 'period' | 'projects' | 'insights' | 'reports'

// Needs attention starts folded; once someone opens or folds a section, their choice is remembered.
const STARTS_CLOSED: Record<string, boolean> = { attention: true }

function loadClosed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...STARTS_CLOSED, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...STARTS_CLOSED }
  }
}

/** Which dashboard sections are collapsed, remembered per browser. Storage
 * can be blocked or empty, in which case every section just starts open. */
export function useDashSections() {
  const [closed, setClosed] = useState<Record<string, boolean>>(loadClosed)

  function persist(next: Record<string, boolean>) {
    setClosed(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not remembered across reloads — still works for this visit.
    }
  }

  return {
    isOpen: (id: DashSectionId) => !closed[id],
    toggle: (id: DashSectionId) => persist({ ...closed, [id]: !closed[id] }),
    open: (id: DashSectionId) => {
      if (closed[id]) persist({ ...closed, [id]: false })
    },
  }
}

export function DashSection({
  id,
  title,
  note,
  open,
  onToggle,
  children,
}: {
  id: DashSectionId
  title: string
  /** Quiet qualifier next to the title, e.g. which period it follows. */
  note?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section id={`dash-${id}`} className="dash-section">
      <button type="button" className="dash-section-head" aria-expanded={open} onClick={onToggle}>
        <span className="dash-section-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span>{title}</span>
        {note && <span className="dash-section-note">{note}</span>}
      </button>
      {open && <div className="dash-section-body">{children}</div>}
    </section>
  )
}
