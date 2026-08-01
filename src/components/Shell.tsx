import { useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Sidebar } from './Sidebar'
import { MobileFooter } from './MobileFooter'
import { MobileFab } from './MobileFab'
import { type TabId } from '../lib/nav'
import laavinMark from '../assets/laavin-mark.png'
import './Shell.css'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', cxo: 'CXO' }

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function Shell({
  active,
  onChange,
  children,
}: {
  active: TabId
  onChange: (tab: TabId) => void
  children: ReactNode
}) {
  const { signOut, profile } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const designation = profile ? ROLE_LABEL[profile.role] : ''

  return (
    <div className="app-layout">
      <Sidebar active={active} onChange={onChange} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="app-main">
        <div className="wrap">
          <div className="shell-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="topbar-mark" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                <img src={laavinMark} alt="" />
              </button>
              <div className="header-user">
                <div className="header-user-name">{profile?.name ?? ''}</div>
                {designation && <div className="header-user-designation">{designation}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button className="icon-btn danger" onClick={() => signOut()} title="Log out" aria-label="Log out">
                <LogoutIcon />
              </button>
            </div>
          </div>

          <div className="shell-content">{children}</div>
        </div>
      </div>

      <MobileFab onChange={onChange} />
      <MobileFooter active={active} onChange={onChange} />
    </div>
  )
}
