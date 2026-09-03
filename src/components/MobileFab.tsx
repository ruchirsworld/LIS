import type { TabId } from '../lib/nav'
import './MobileFab.css'

/** Mobile-only floating action button — jumps straight to the Expenses tab. */
export function MobileFab({ onChange }: { onChange: (tab: TabId) => void }) {
  return (
    <div className="mobile-fab-wrap">
      <button type="button" className="mobile-fab" onClick={() => onChange('expenses')} aria-label="Add expense">
        +
      </button>
    </div>
  )
}
