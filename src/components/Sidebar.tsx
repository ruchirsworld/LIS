import { NAV_GROUPS, TABS, isTabVisible, type TabId } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import { APP_VERSION } from '../lib/version'
import { NavIcon } from './NavIcons'
import { InstallAppButton } from './InstallAppButton'
import laavinLogo from '../assets/laavin-logo.jpg'
import './Sidebar.css'

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
  /** Pending-approvals count shown as a small badge on the Approvals item —
   * previously only visible via the header's hamburger menu button. */
  approvalsBadge?: number
}) {
  const { profile } = useAuth()
  const isAdminSide = profile?.role === 'admin' || profile?.role === 'cxo'
  const isSupervisor = profile?.role === 'supervisor'
  const t = useT()
  // A Supervisor's Expenses tab only ever shows Project claims + advance
  // requests — "Claims & Advances" says that more precisely than the
  // generic "Expenses" label Admin/CXO keep (their tab covers Admin/Trips
  // spend too).
  const navLabel = (tab: { id: TabId; label: string }) =>
    tab.id === 'expenses' && isSupervisor ? t('Claims & Advances') : t(tab.label)

  const visible = TABS.filter((tab) => isTabVisible(tab, profile?.role))
  // Back office sees grouped sections; a Supervisor's short list stays flat.
  const sections: { label: string | null; tabs: typeof visible }[] = isAdminSide
    ? NAV_GROUPS.map((g) => ({ label: g.label, tabs: visible.filter((tab) => g.ids.includes(tab.id)) })).filter((s) => s.tabs.length > 0)
    : [{ label: null, tabs: visible }]

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <button
          type="button"
          className="sidebar-logo-btn"
          onClick={() => {
            onChange('dashboard')
            onClose()
          }}
          aria-label="Go to Dashboard"
        >
          <img src={laavinLogo} alt="Laavin InfraScapes" className="sidebar-logo" />
        </button>
        <nav className="sidebar-nav" aria-label="Main">
          {sections.map((section) => (
            <div key={section.label ?? 'all'} className="sidebar-group">
              {section.label && <div className="sidebar-group-label">{section.label}</div>}
              {section.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === active ? 'sidebar-item active' : 'sidebar-item'}
                  aria-current={tab.id === active ? 'page' : undefined}
                  onClick={() => {
                    onChange(tab.id)
                    onClose()
                  }}
                >
                  <span className="sidebar-icon" aria-hidden="true">
                    <NavIcon id={tab.id} />
                    {tab.id === 'approvals' && !!approvalsBadge && approvalsBadge > 0 && (
                      <span className="sidebar-badge">{approvalsBadge}</span>
                    )}
                  </span>
                  {navLabel(tab)}
                  {tab.id === 'approvals' && !!approvalsBadge && approvalsBadge > 0 && <span className="sr-only"> ({approvalsBadge} waiting)</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <InstallAppButton />
        <div className="sidebar-version">{APP_VERSION}</div>
      </aside>
    </>
  )
}
