import { TABS, type TabId } from '../lib/nav'
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
}: {
  active: TabId
  onChange: (tab: TabId) => void
  open: boolean
  onClose: () => void
}) {
  const { isAdmin } = useAuth()

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <img src={laavinLogo} alt="Laavin InfraScapes" className="sidebar-logo" />
        <nav className="sidebar-nav">
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
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
