import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Sidebar } from './Sidebar'
import { SearchLauncher } from './CommandPalette'
import { MobileFooter } from './MobileFooter'
import { PageHeader, ShellTitleContext } from './PageHeader'
import { NewEntryMenu } from './NewEntryMenu'
import { useStackedTables } from './useStackedTables'
import { moduleOfTab } from '../lib/nav'
import { rememberSubTab } from '../lib/moduleMemory'
import { usePendingApprovalsCount } from '../lib/queries/approvals'
import { useLanguage } from '../lib/i18n'
import type { TabId } from '../lib/nav'
import laavinMark from '../assets/laavin-mark.png'
import './Shell.css'

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export interface SplitControl {
  /** Wide enough (and the right role) for two pages side by side. */
  canSplit: boolean
  /** The second pane is currently showing. */
  isOpen: boolean
  onToggle: () => void
  tab: TabId | null
}

export function Shell({
  active,
  onChange,
  split,
  children,
}: {
  active: TabId
  onChange: (tab: TabId) => void
  split?: SplitControl
  children: ReactNode
}) {
  const { signOut, profile } = useAuth()
  const canApprove = profile?.role === 'admin' || profile?.role === 'cxo'
  const isAdminSide = canApprove
  const isSupervisor = profile?.role === 'supervisor'
  const { lang, setLang } = useLanguage()
  const pendingApprovalsCount = usePendingApprovalsCount(canApprove)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)
  const mainRef = useRef<HTMLElement>(null)
  useStackedTables(mainRef)

  // Opening a module again lands on the sub-tab this person last used there.
  useEffect(() => {
    const mod = moduleOfTab(active, profile?.role)
    if (mod) rememberSubTab(profile?.id, mod.id, active)
  }, [active, profile?.id, profile?.role])

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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        active={active}
        onChange={onChange}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        approvalsBadge={pendingApprovalsCount}
      />

      <div className={split?.isOpen ? 'app-main split' : 'app-main'}>
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
              {split?.canSplit && (
                <button
                  type="button"
                  className={split.isOpen ? 'pay-btn split-toggle active' : 'pay-btn split-toggle'}
                  onClick={split.onToggle}
                  title="Show a second page next to this one"
                >
                  {split.isOpen ? 'Close split' : 'Split view'}
                </button>
              )}
              {isSupervisor && (
                <button
                  type="button"
                  className="pay-btn"
                  onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                  aria-label="Switch language"
                  title="Switch language"
                >
                  {lang === 'en' ? 'हिं' : 'EN'}
                </button>
              )}
              <NewEntryMenu />
              {isAdminSide && <SearchLauncher onNavigate={onChange} />}
              {isAdminSide && (
                <button
                  type="button"
                  className="icon-btn bell-btn"
                  onClick={() => onChange('approvals')}
                  aria-label={pendingApprovalsCount > 0 ? `Approvals: ${pendingApprovalsCount} waiting` : 'Approvals'}
                  title={pendingApprovalsCount > 0 ? `${pendingApprovalsCount} waiting for approval` : 'Nothing waiting for approval'}
                >
                  <BellIcon />
                  {pendingApprovalsCount > 0 && <span className="bell-badge">{pendingApprovalsCount}</span>}
                </button>
              )}
              <button type="button" className="icon-btn danger" onClick={() => signOut()} aria-label="Sign out" title="Sign out">
                <SignOutIcon />
              </button>
            </div>
          </div>

          <main className="shell-content" id="main-content" tabIndex={-1} ref={mainRef}>
            {!split?.isOpen && <PageHeader active={active} onChange={onChange} />}
            <ShellTitleContext.Provider value={!split?.isOpen}>{children}</ShellTitleContext.Provider>
          </main>
        </div>
      </div>

      <NewEntryMenu floating />
      <MobileFooter active={active} onChange={onChange} />
    </div>
  )
}
