import { TABS, isTabVisible, HEADER_MENU_TAB_IDS, type TabId } from '../lib/nav'
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
        <nav className="sidebar-nav">
          {TABS.filter((tab) => isTabVisible(tab, profile?.role) && !(isAdminSide && HEADER_MENU_TAB_IDS.includes(tab.id))).map(
            (tab) => (
              <button
                key={tab.id}
                className={tab.id === active ? 'sidebar-item active' : 'sidebar-item'}
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
              </button>
            )
          )}
        </nav>
        <InstallAppButton />
        <div className="sidebar-version">{APP_VERSION}</div>
      </aside>
    </>
  )
}
