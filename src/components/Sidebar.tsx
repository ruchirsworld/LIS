import { TABS, isTabVisible, type TabId } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { APP_VERSION } from '../lib/version'
import { NavIcon } from './NavIcons'
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
          {TABS.filter((t) => isTabVisible(t, profile?.role)).map((t) => (
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
        <div className="sidebar-version">{APP_VERSION}</div>
      </aside>
    </>
  )
}
