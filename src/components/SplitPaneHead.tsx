import type { TabId } from '../lib/nav'

/** Top strip of the second pane in split view: pick which page it shows, or
 * close the split. The first pane is driven by the normal sidebar. */
export function SplitPaneHead({
  tab,
  tabs,
  onChange,
  onClose,
}: {
  tab: TabId
  tabs: { id: TabId; label: string }[]
  onChange: (tab: TabId) => void
  onClose: () => void
}) {
  return (
    <div className="split-pane-head">
      <label className="split-pane-pick">
        <span>Second view</span>
        <select value={tab} onChange={(e) => onChange(e.target.value as TabId)}>
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="split-close" onClick={onClose}>
        Close split
      </button>
    </div>
  )
}
