export const TABS = [
  { id: 'dashboard', label: 'Dashboard', adminOnly: false },
  { id: 'expenses', label: 'Expenses', adminOnly: false },
  { id: 'team', label: 'Team', adminOnly: false },
  { id: 'purchases', label: 'Purchases', adminOnly: false },
  { id: 'invoices', label: 'Invoices', adminOnly: false },
  { id: 'loans', label: 'Loans', adminOnly: false },
  { id: 'capital', label: 'Capital', adminOnly: false },
  { id: 'transfers', label: 'Transfers', adminOnly: false },
  { id: 'projects', label: 'Projects', adminOnly: false },
  { id: 'reports', label: 'Reports', adminOnly: false },
  { id: 'admin', label: 'Admin', adminOnly: true },
] as const

export type TabId = (typeof TABS)[number]['id']
