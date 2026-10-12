import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { TABS, isTabVisible, type TabId } from '../lib/nav'
import { useGoTo } from '../lib/navContext'
import { useClients, useProjects, useStaff, useVendors } from '../lib/queries/masters'
import { useInvoices } from '../lib/queries/invoices'
import './CommandPalette.css'

interface Hit {
  key: string
  kind: 'Page' | 'Client' | 'Invoice' | 'Vendor' | 'Project' | 'Staff'
  label: string
  detail?: string
  go: () => void
}

const MAX_HITS = 14

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

/** Header button + Ctrl+K search over pages, clients, invoices, vendors, projects and staff. */
export function SearchLauncher({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = /^(input|textarea|select)$/i.test((e.target as HTMLElement | null)?.tagName ?? '')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !typing && !(e.target as HTMLElement | null)?.isContentEditable) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button type="button" className="search-launch" onClick={() => setOpen(true)} aria-label="Search" title="Search (Ctrl+K)">
        <SearchIcon />
        <span className="search-launch-text">Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && <CommandPalette onClose={() => setOpen(false)} onNavigate={onNavigate} />}
    </>
  )
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (tab: TabId) => void }) {
  const { profile } = useAuth()
  const goTo = useGoTo()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: projects } = useProjects()
  const { data: staff } = useStaff()
  const { data: invoices } = useInvoices(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    const go = (tab: TabId, filter?: { clientId?: string }) => () => {
      if (goTo) goTo(tab, filter ? { filter } : undefined)
      else onNavigate(tab)
      onClose()
    }
    const match = (...parts: (string | null | undefined)[]) => !q || parts.some((p) => p && p.toLowerCase().includes(q))

    const pages: Hit[] = TABS.filter((t) => isTabVisible(t, profile?.role) && match(t.label)).map((t) => ({
      key: `page-${t.id}`,
      kind: 'Page',
      label: t.label,
      go: go(t.id),
    }))
    if (!q) return pages.slice(0, MAX_HITS)

    const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]))
    const found: Hit[] = [
      ...(clients ?? [])
        .filter((c) => match(c.name, c.client_code, c.gst))
        .map<Hit>((c) => ({ key: `c-${c.id}`, kind: 'Client', label: c.name, detail: c.client_code ?? undefined, go: go('invoices', { clientId: c.id }) })),
      ...(invoices ?? [])
        .filter((i) => match(i.invoice_number, i.display_id))
        .map<Hit>((i) => ({
          key: `i-${i.id}`,
          kind: 'Invoice',
          label: i.invoice_number || i.display_id || 'Invoice',
          detail: clientName.get(i.client_id) ?? undefined,
          go: go('invoices', { clientId: i.client_id }),
        })),
      ...(vendors ?? []).filter((v) => match(v.name, v.gstin)).map<Hit>((v) => ({ key: `v-${v.id}`, kind: 'Vendor', label: v.name, go: go('vendor') })),
      ...(projects ?? []).filter((p) => match(p.name, p.code)).map<Hit>((p) => ({ key: `p-${p.id}`, kind: 'Project', label: p.name, detail: p.code ?? undefined, go: go('projects') })),
      ...(staff ?? []).filter((s) => match(s.name, s.phone)).map<Hit>((s) => ({ key: `s-${s.id}`, kind: 'Staff', label: s.name, go: go('hr') })),
    ]
    return [...pages, ...found].slice(0, MAX_HITS)
  }, [query, clients, vendors, projects, staff, invoices, goTo, onNavigate, onClose, profile?.role])

  useEffect(() => setIndex(0), [query])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      hits[index]?.go()
    }
  }

  return (
    <div className="modal-backdrop palette-backdrop" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="palette-input">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, invoices, vendors, projects, staff or pages"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={hits[index] ? `palette-${hits[index].key}` : undefined}
          />
        </div>
        <ul className="palette-list" id="palette-list" role="listbox">
          {hits.length === 0 && <li className="palette-empty">Nothing matches “{query}”.</li>}
          {hits.map((h, i) => (
            <li
              key={h.key}
              id={`palette-${h.key}`}
              role="option"
              aria-selected={i === index}
              className={i === index ? 'palette-item active' : 'palette-item'}
              onMouseEnter={() => setIndex(i)}
              onClick={h.go}
            >
              <span className={`palette-kind kind-${h.kind.toLowerCase()}`}>{h.kind}</span>
              <span className="palette-label">{h.label}</span>
              {h.detail && <span className="palette-detail">{h.detail}</span>}
            </li>
          ))}
        </ul>
        <div className="palette-foot">↑ ↓ to move · Enter to open · Esc to close</div>
      </div>
    </div>
  )
}
