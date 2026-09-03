import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Sidebar } from './Sidebar'
import { RowMenu } from './RowMenu'
import { MobileFooter } from './MobileFooter'
import { MobileFab } from './MobileFab'
import { usePendingApprovalsCount } from '../lib/queries/approvals'
import { TABS, isTabVisible, HEADER_MENU_TAB_IDS, type TabId } from '../lib/nav'
import laavinMark from '../assets/laavin-mark.png'
import './Shell.css'

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const canApprove = profile?.role === 'admin' || profile?.role === 'cxo'
  const isAdminSide = canApprove
  const pendingApprovalsCount = usePendingApprovalsCount(canApprove)
  // Admin/CXO only — these tabs live in the hamburger instead of the
  // Sidebar (see HEADER_MENU_TAB_IDS); a Supervisor's sidebar keeps them
  // inline, so this list stays empty for that role.
  const headerMenuTabs = TABS.filter((t) => isAdminSide && HEADER_MENU_TAB_IDS.includes(t.id) && isTabVisible(t, profile?.role))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)

  // Mobile-only: hide the header while scrolling down (more room for content),
  // reveal it again on scroll up or near the top — menu/logout stay reachable,
  // just not permanently taking up space. CSS gates the actual hide effect to
  // narrow viewports, so this is a no-op on desktop.
  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY
      if (y < 24) {
        setHeaderHidden(false)
      } else if (y > lastScrollY.current) {
        setHeaderHidden(true)
      } else if (y < lastScrollY.current) {
        setHeaderHidden(false)
      }
      lastScrollY.current = y
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="app-layout">
      <Sidebar
        active={active}
        onChange={onChange}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        approvalsBadge={pendingApprovalsCount}
      />

      <div className="app-main">
        <div className="wrap">
          <div className={headerHidden ? 'shell-header hide-on-scroll' : 'shell-header'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="topbar-mark" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                <img src={laavinMark} alt="" />
              </button>
              <div className="header-user">
                <div className="header-user-name">{profile?.name ?? ''}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {isAdminSide ? (
                <RowMenu
                  badge={pendingApprovalsCount}
                  items={[
                    ...headerMenuTabs.map((t) => ({ label: t.label, onClick: () => onChange(t.id) })),
                    { label: 'Sign out', onClick: () => signOut() },
                  ]}
                />
              ) : (
                <button type="button" className="icon-btn danger" onClick={() => signOut()} aria-label="Sign out" title="Sign out">
                  <SignOutIcon />
                </button>
              )}
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
