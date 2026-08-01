import { TABS, type TabId } from '../lib/nav'
import { NavIcon } from './NavIcons'
import './MobileFooter.css'

const QUICK_ACCESS_IDS: TabId[] = ['expenses', 'purchases', 'dashboard', 'projects', 'reports']
const FOOTER_ITEMS = QUICK_ACCESS_IDS.map((id) => TABS.find((t) => t.id === id)!)

export function MobileFooter({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="mobile-footer" aria-label="Quick access">
      {FOOTER_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === active ? 'mobile-footer-item active' : 'mobile-footer-item'}
          onClick={() => onChange(item.id)}
        >
          <span className="mobile-footer-icon" aria-hidden="true">
            <NavIcon id={item.id} size={26} />
          </span>
          <span className="mobile-footer-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
