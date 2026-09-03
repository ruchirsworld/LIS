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

// Admin/CXO only: these tabs sit in the header's hamburger menu (next to
// Sign out) instead of the main Sidebar list — their sidebar would otherwise
// be a long flat list of everything. A Supervisor's sidebar is short enough
// already (Dashboard, Expenses, Calendar, Records) and keeps all of it
// inline, so this set is never applied to that role.
export const HEADER_MENU_TAB_IDS: readonly TabId[] = ['approvals', 'calendar', 'projects', 'reports', 'admin']

// The Expenses tab's three flows, merged behind one cost-center switcher in
// its header — was three separate tabs (Admin / Trips / Project) before
// consolidation.
export const EXPENSE_COST_CENTERS = ['Admin', 'Trips', 'Project'] as const
export type ExpenseCostCenter = (typeof EXPENSE_COST_CENTERS)[number]

// A Supervisor only ever claims their own project spend through this tab —
// Admin Expenses and Trips aren't theirs to touch.
export const SUPERVISOR_EXPENSE_COST_CENTERS = ['Project'] as const
