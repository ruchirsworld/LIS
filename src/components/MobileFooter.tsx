import { TABS, isTabVisible, type TabId } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { usePendingApprovalsCount } from '../lib/queries/approvals'
import { NavIcon } from './NavIcons'
import './MobileFooter.css'

// 'records' only ever shows for a Supervisor (role-gated in nav.ts) — it
// doesn't take a slot away from Admin/CXO's own items below.
const QUICK_ACCESS_IDS: TabId[] = ['expenses', 'records', 'purchases', 'calendar', 'hr', 'approvals']
const FOOTER_ITEMS = QUICK_ACCESS_IDS.map((id) => TABS.find((t) => t.id === id)!)

export function MobileFooter({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { profile } = useAuth()
  const canApprove = profile?.role === 'admin' || profile?.role === 'cxo'
  const pendingApprovalsCount = usePendingApprovalsCount(canApprove)
  const visibleItems = FOOTER_ITEMS.filter((item) => isTabVisible(item, profile?.role))

  return (
    <nav className="mobile-footer" aria-label="Quick access">
      {visibleItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === active ? 'mobile-footer-item active' : 'mobile-footer-item'}
          onClick={() => onChange(item.id)}
        >
          <span className="mobile-footer-icon" aria-hidden="true">
            <NavIcon id={item.id} size={26} />
            {item.id === 'approvals' && canApprove && pendingApprovalsCount > 0 && (
              <span className="mobile-footer-badge">{pendingApprovalsCount}</span>
            )}
          </span>
          <span className="mobile-footer-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
