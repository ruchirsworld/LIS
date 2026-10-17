import { createContext } from 'react'
import { ChevronRight } from 'lucide-react'
import { SUPERVISOR_MODULE_LABEL, TABS, moduleOfTab, subTabLabel, type TabId } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

/** True inside the app shell, which draws the page title itself, so a page's own ModuleHeader shows only its controls. */
export const ShellTitleContext = createContext(false)

/** The top of every page: breadcrumbs, the page title, and the module's sub-tabs. The same on every page. */
export function PageHeader({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { profile } = useAuth()
  const t = useT()
  const isSupervisor = profile?.role === 'supervisor'
  const mod = moduleOfTab(active, profile?.role)

  // The Dashboard belongs to no module: just its title.
  if (!mod) {
    const label = TABS.find((x) => x.id === active)?.label ?? ''
    return (
      <header className="page-head">
        <h1 className="page-title">{t(label)}</h1>
      </header>
    )
  }

  const moduleLabel = t(isSupervisor ? SUPERVISOR_MODULE_LABEL[mod.id] ?? mod.label : mod.label)
  const subLabel = (id: TabId) => (isSupervisor && id === 'expenses' ? t('Claims & Advances') : t(subTabLabel(id)))
  const hasTabs = mod.tabs.length > 1
  // A page reached another way (Approvals, from the bell) is named on its own, under its place in the menu.
  const onSidePage = !mod.tabs.includes(active)
  const named = hasTabs || onSidePage
  const title = named ? subLabel(active) : moduleLabel

  return (
    <header className="page-head">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <span>{moduleLabel}</span>
        {named && (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{subLabel(active)}</span>
          </>
        )}
      </nav>
      <h1 className="page-title">{title}</h1>
      {hasTabs && (
        <div className="subtabs" role="tablist" aria-label={`${moduleLabel} sections`}>
          {mod.tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === active}
              className={id === active ? 'subtab active' : 'subtab'}
              onClick={() => onChange(id)}
            >
              {subLabel(id)}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
