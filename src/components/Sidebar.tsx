import { TABS, isTabVisible, HEADER_MENU_TAB_IDS, type TabId } from '../lib/nav'
import { useAuth } from '../lib/auth'
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
          {TABS.filter((t) => isTabVisible(t, profile?.role) && !(isAdminSide && HEADER_MENU_TAB_IDS.includes(t.id))).map((t) => (
            <button
              key={t.id}
              className={t.id === active ? 'sidebar-item active' : 'sidebar-item'}
              onClick={() => {
                onChange(t.id)
                onClose()
              }}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <NavIcon id={t.id} />
                {t.id === 'approvals' && !!approvalsBadge && approvalsBadge > 0 && (
                  <span className="sidebar-badge">{approvalsBadge}</span>
                )}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
        <InstallAppButton />
        <div className="sidebar-version">{APP_VERSION}</div>
      </aside>
    </>
  )
}
