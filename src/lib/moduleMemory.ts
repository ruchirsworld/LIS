import { isTabVisible, modulesFor, TABS, type ModuleId, type NavRole, type TabId } from './nav'

// Each person's last-open sub-tab in each module, so opening Finance again lands where they were. Kept in this browser only.
const key = (userId: string, module: ModuleId) => `lis.subtab.${userId}.${module}`

export function rememberSubTab(userId: string | undefined, module: ModuleId, tab: TabId) {
  if (!userId) return
  try {
    localStorage.setItem(key(userId, module), tab)
  } catch {
    // Storage blocked: the module just opens on its first sub-tab.
  }
}

/** The page to open when a module is chosen from the menu: the last sub-tab this person used there, else its first. */
export function landingTab(userId: string | undefined, module: ModuleId, role: NavRole | undefined): TabId {
  const mod = modulesFor(role).find((m) => m.id === module)
  const first = mod?.tabs[0] ?? 'dashboard'
  if (!userId || !mod) return first
  try {
    const saved = localStorage.getItem(key(userId, module)) as TabId | null
    const def = saved ? TABS.find((t) => t.id === saved) : undefined
    if (saved && def && mod.tabs.includes(saved) && isTabVisible(def, role)) return saved
  } catch {
    // fall through
  }
  return first
}
