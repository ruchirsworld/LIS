import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useGoTo } from '../lib/navContext'
import { useAuth } from '../lib/auth'
import type { ExpenseCostCenter, TabId } from '../lib/nav'

interface Entry {
  label: string
  tab: TabId
  costCenter?: ExpenseCostCenter
}

const BACK_OFFICE_ENTRIES: Entry[] = [
  { label: 'Expense: Admin', tab: 'expenses', costCenter: 'Admin' },
  { label: 'Expense: Trip', tab: 'expenses', costCenter: 'Trips' },
  { label: 'Expense: Project', tab: 'expenses', costCenter: 'Project' },
  { label: 'Vendor bill', tab: 'purchases' },
  { label: 'Invoice or payment received', tab: 'invoices' },
  { label: 'Loan', tab: 'loans' },
  { label: 'Capital', tab: 'capital' },
  { label: 'Transfer', tab: 'transfers' },
]

const SUPERVISOR_ENTRIES: Entry[] = [{ label: 'Claim or advance', tab: 'expenses', costCenter: 'Project' }]

/** "+ New entry", always in the top bar: choose what to record and it opens that page with its form at the top. */
export function NewEntryMenu({ floating }: { floating?: boolean }) {
  const goTo = useGoTo()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!goTo) return null
  const entries = profile?.role === 'supervisor' ? SUPERVISOR_ENTRIES : BACK_OFFICE_ENTRIES

  return (
    <div className={floating ? 'new-entry new-entry-floating' : 'new-entry new-entry-inline'} ref={rootRef}>
      {floating ? (
        <button type="button" className="new-entry-fab" aria-haspopup="menu" aria-expanded={open} aria-label="New entry" onClick={() => setOpen((v) => !v)}>
          <Plus size={26} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="btn cta new-entry-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Plus size={16} aria-hidden="true" />
          New entry
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="new-entry-menu" role="menu">
          {entries.map((e) => (
            <button
              key={e.label}
              type="button"
              role="menuitem"
              className="new-entry-item"
              onClick={() => {
                setOpen(false)
                goTo(e.tab, e.costCenter ? { costCenter: e.costCenter } : undefined)
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
