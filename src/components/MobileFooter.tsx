import { SUPERVISOR_MODULE_LABEL, moduleOfTab, modulesFor, type TabId } from '../lib/nav'
import { landingTab } from '../lib/moduleMemory'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import { usePendingApprovalsCount } from '../lib/queries/approvals'
import { MODULE_ICON } from './moduleIcons'
import './MobileFooter.css'

// The bottom bar holds the first five menu modules (Reports and Settings are in the drawer, opened from the logo in the top bar).
const MAX_ITEMS = 5

export function MobileFooter({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { profile } = useAuth()
  const canApprove = profile?.role === 'admin' || profile?.role === 'cxo'
  const isSupervisor = profile?.role === 'supervisor'
  const pendingApprovalsCount = usePendingApprovalsCount(canApprove)
  const t = useT()
  const items = modulesFor(profile?.role)
    .filter((m) => m.id !== 'settings' && m.id !== 'reports')
    .slice(0, MAX_ITEMS)
  const current = moduleOfTab(active, profile?.role)

  return (
    <nav className="mobile-footer" aria-label="Quick access">
      {items.map((m) => {
        const Icon = MODULE_ICON[m.id]
        const isActive = current?.id === m.id
        const label = t(isSupervisor ? SUPERVISOR_MODULE_LABEL[m.id] ?? m.label : m.label)
        const badge = m.id === 'expenses' && canApprove ? pendingApprovalsCount : 0
        return (
          <button
            key={m.id}
            type="button"
            className={isActive ? 'mobile-footer-item active' : 'mobile-footer-item'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(landingTab(profile?.id, m.id, profile?.role))}
          >
            <span className="mobile-footer-icon" aria-hidden="true">
              <Icon size={24} strokeWidth={1.75} />
              {badge > 0 && <span className="mobile-footer-badge">{badge}</span>}
            </span>
            <span className="mobile-footer-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
