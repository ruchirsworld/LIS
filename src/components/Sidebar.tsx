import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { SUPERVISOR_MODULE_LABEL, moduleOfTab, modulesFor, type ModuleId, type TabId } from '../lib/nav'
import { landingTab } from '../lib/moduleMemory'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import { APP_VERSION } from '../lib/version'
import { MODULE_ICON } from './moduleIcons'
import { InstallAppButton } from './InstallAppButton'
import laavinLogo from '../assets/laavin-logo.jpg'
import laavinMark from '../assets/laavin-mark.png'
import './Sidebar.css'

const COLLAPSED_KEY = 'lis.sidebar.collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar({
  active,
  onChange,
  open,
  onClose,
  approvalsBadge,
}: {
  active: TabId
  onChange: (tab: TabId) => void
  open: boolean
  onClose: () => void
  /** Pending-approvals count, shown as a small amber pill on the Expenses item (Approvals is a sub-tab there). */
  approvalsBadge?: number
}) {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const t = useT()
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const modules = modulesFor(profile?.role)
  const current = moduleOfTab(active, profile?.role)
  const main = modules.filter((m) => m.id !== 'settings')
  const settings = modules.find((m) => m.id === 'settings')

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Storage blocked: the choice just won't survive a reload.
      }
      return !c
    })
  }

  const labelOf = (id: ModuleId, label: string) => t(isSupervisor ? SUPERVISOR_MODULE_LABEL[id] ?? label : label)

  function item(m: { id: ModuleId; label: string }) {
    const Icon = MODULE_ICON[m.id]
    const isActive = current?.id === m.id
    const label = labelOf(m.id, m.label)
    const badge = m.id === 'expenses' && !!approvalsBadge && approvalsBadge > 0 ? approvalsBadge : 0
    return (
      <button
        key={m.id}
        type="button"
        className={isActive ? 'sidebar-item active' : 'sidebar-item'}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={() => {
          onChange(landingTab(profile?.id, m.id, profile?.role))
          onClose()
        }}
      >
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="sidebar-icon" />
        <span className="sidebar-label">{label}</span>
        {badge > 0 && (
          <span className="sidebar-badge">
            {badge}
            <span className="sr-only"> waiting for approval</span>
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={['sidebar', open ? 'open' : '', collapsed ? 'collapsed' : ''].filter(Boolean).join(' ')}>
        <div className="sidebar-logo-area">
          <button
            type="button"
            className="sidebar-logo-btn"
            onClick={() => {
              onChange('dashboard')
              onClose()
            }}
            aria-label="Go to Dashboard"
            title="Dashboard"
          >
            <img src={collapsed ? laavinMark : laavinLogo} alt="Laavin InfraScapes" className={collapsed ? 'sidebar-logo sidebar-logo-mark' : 'sidebar-logo'} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main">
          {main.map(item)}
          {settings && (
            <>
              <div className="sidebar-spacer" />
              <hr className="sidebar-divider" />
              {item(settings)}
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <InstallAppButton />
          <div className="sidebar-foot-row">
            <span className="sidebar-version">{APP_VERSION}</span>
            <button
              type="button"
              className="sidebar-collapse"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
