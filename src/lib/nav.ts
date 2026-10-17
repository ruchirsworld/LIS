// null = visible to every role. Otherwise the exact roles that can see the
// tab — a Supervisor is a field employee, not a business-controls user, so
// their nav collapses to just Dashboard (their own) and Expenses (their own
// claims); everything else here is Admin/CXO territory.
export const TABS = [
  { id: 'dashboard', label: 'Dashboard', roles: null },
  { id: 'expenses', label: 'Expenses', roles: null },
  // A Supervisor's own claims and field-worker claims from LIS_Fields sit
  // here until an Admin/CXO reviews them — neither becomes a real record
  // until approved. Not a Supervisor concern: they can't approve their own.
  { id: 'approvals', label: 'Approvals', roles: ['admin', 'cxo'] },
  // Lets an Admin/CXO fill in the exact same Project-claim form a Supervisor
  // uses, submitting under a chosen supervisor's name — for phoning in
  // entries on their behalf rather than routing through Approvals.
  { id: 'supervisor', label: 'Supervisor', roles: ['admin', 'cxo'] },
  // A Supervisor's own team calendar and expense/payment history — Admin/CXO
  // get the same Calendar tab too (picking which supervisor's team to view),
  // but Records is a "what I personally submitted" view specific to a
  // Supervisor's claims; Admin/CXO already have that company-wide via
  // Reports/Expenses.
  { id: 'calendar', label: 'Calendar', roles: null },
  { id: 'records', label: 'Records', roles: ['supervisor'] },
  { id: 'purchases', label: 'Procurements', roles: ['admin', 'cxo'] },
  { id: 'vendor', label: 'Vendor', roles: ['admin', 'cxo'] },
  { id: 'invoices', label: 'Invoices', roles: ['admin', 'cxo'] },
  { id: 'loans', label: 'Loans', roles: ['admin', 'cxo'] },
  { id: 'capital', label: 'Capital', roles: ['admin', 'cxo'] },
  { id: 'transfers', label: 'Transfers', roles: ['admin', 'cxo'] },
  // Bank reconciliation lives under Finance. It is the same screen that is also listed in Reports.
  { id: 'reconciliation', label: 'Reconciliation', roles: ['admin', 'cxo'] },
  { id: 'projects', label: 'Projects', roles: ['admin', 'cxo'] },
  { id: 'hr', label: 'HR', roles: ['admin', 'cxo'] },
  { id: 'reports', label: 'Reports', roles: ['admin', 'cxo'] },
  // Settings itself is visible to both — AdminPage gates "Additional
  // Settings" (Cost Centers, Chart of Accounts, Units, Bank Accounts, Users)
  // to Admin only internally, so CXO only ever sees General Settings there.
  { id: 'admin', label: 'Settings', roles: ['admin', 'cxo'] },
] as const

export type TabId = (typeof TABS)[number]['id']
export type NavRole = 'admin' | 'cxo' | 'supervisor'

export function isTabVisible(tab: { roles: readonly string[] | null }, role: NavRole | undefined): boolean {
  return !tab.roles || (!!role && (tab.roles as readonly string[]).includes(role))
}

// The menu. Seven places, in this order; Settings sits apart at the bottom. The logo opens the Dashboard, so it has no menu item of
// its own. Each module is one page with its own sub-tabs; the sub-tabs are the pages that used to be separate menu items, so
// nothing was removed, only grouped.
export type ModuleId = 'expenses' | 'procurement' | 'clients' | 'team' | 'finance' | 'reports' | 'settings'

export interface NavModule {
  id: ModuleId
  label: string
  /** The sub-tabs, in order. A sub-tab the person's role cannot see is left out. */
  tabs: readonly TabId[]
}

export const MODULES: readonly NavModule[] = [
  { id: 'expenses', label: 'Expenses', tabs: ['expenses', 'approvals', 'supervisor', 'projects', 'records'] },
  { id: 'procurement', label: 'Procurement', tabs: ['purchases', 'vendor'] },
  { id: 'clients', label: 'Clients', tabs: ['invoices'] },
  { id: 'team', label: 'Team', tabs: ['hr', 'calendar'] },
  { id: 'finance', label: 'Finance', tabs: ['loans', 'capital', 'transfers', 'reconciliation'] },
  { id: 'reports', label: 'Reports', tabs: ['reports'] },
  { id: 'settings', label: 'Settings', tabs: ['admin'] },
]

/** What a page is called inside its module (the sub-tab and the page title). */
const SUB_TAB_LABEL: Partial<Record<TabId, string>> = {
  expenses: 'Expenses',
  approvals: 'Approvals',
  supervisor: 'Enter for a supervisor',
  projects: 'Projects',
  records: 'My records',
  purchases: 'Purchases',
  vendor: 'Vendors',
  invoices: 'Invoices & payments',
  hr: 'HR & payroll',
  calendar: 'Attendance',
  loans: 'Loans',
  capital: 'Capital',
  transfers: 'Transfers',
  reconciliation: 'Reconciliation',
  reports: 'Reports',
  admin: 'Settings',
}

export function subTabLabel(tab: TabId): string {
  return SUB_TAB_LABEL[tab] ?? TABS.find((t) => t.id === tab)?.label ?? tab
}

function tabDef(id: TabId) {
  return TABS.find((t) => t.id === id)!
}

/** The modules this role can open, each with only the sub-tabs it can see. */
export function modulesFor(role: NavRole | undefined): (NavModule & { tabs: readonly TabId[] })[] {
  return MODULES.map((m) => ({ ...m, tabs: m.tabs.filter((id) => isTabVisible(tabDef(id), role)) })).filter((m) => m.tabs.length > 0)
}

/** The module a page belongs to. The Dashboard belongs to none: the logo opens it. */
export function moduleOfTab(tab: TabId, role: NavRole | undefined): (NavModule & { tabs: readonly TabId[] }) | null {
  return modulesFor(role).find((m) => m.tabs.includes(tab)) ?? null
}

// A Supervisor's menu: Expenses (their claims and their own records) and Team (the calendar). A Supervisor's Expenses tab only ever
// shows Project claims and advance requests, so it is called "Claims & Advances".
export const SUPERVISOR_MODULE_LABEL: Partial<Record<ModuleId, string>> = { expenses: 'Claims & Advances' }

// The Expenses tab's three flows, merged behind one cost-center switcher in
// its header — was three separate tabs (Admin / Trips / Project) before
// consolidation.
export const EXPENSE_COST_CENTERS = ['Admin', 'Trips', 'Project'] as const
export type ExpenseCostCenter = (typeof EXPENSE_COST_CENTERS)[number]

// A Supervisor only ever claims their own project spend through this tab —
// Admin Expenses and Trips aren't theirs to touch.
export const SUPERVISOR_EXPENSE_COST_CENTERS = ['Project'] as const
