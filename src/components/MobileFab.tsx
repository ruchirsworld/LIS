import type { TabId } from '../lib/nav'
import './MobileFab.css'

/** Mobile-only floating action button — jumps straight to the Expenses tab,
 * where "Add expense" is the first thing on the page (open by default). */
export function MobileFab({ onChange }: { onChange: (tab: TabId) => void }) {
  return (
    <button type="button" className="mobile-fab" onClick={() => onChange('expenses')} aria-label="Add expense">
      +
    </button>
  )
}
