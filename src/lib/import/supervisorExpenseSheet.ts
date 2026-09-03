// Column layout for the Supervisor Project-expense-claim bulk-import sheet —
// one row per category entry, mirroring SupervisorProjectExpenseForm's own
// fixed category set (see lib/supervisorProjectExpenseCategories.ts).

export const SHEET_SUPERVISOR_EXPENSES = 'Claims'

export const COLUMNS_SUPERVISOR_EXPENSES = [
  'Supervisor',
  'Project',
  'Date (DD-MM-YYYY)',
  'Category (Labour/Transport/Food/Petrol-2T/Tools & Equipment/Miscellaneous)',
  'Amount',
  'Comments (required for Miscellaneous)',
] as const

export const EXAMPLE_ROW_SUPERVISOR_EXPENSES = ['', '', '01-08-2026', 'Food', '400', '']

export const SUPERVISOR_EXPENSES_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Supervisor Project Expense Claims Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Supervisor must match an existing Supervisor by name exactly.',
  '3. Project must match an existing active project by name.',
  '4. Category must be Labour, Transport, Food, Petrol/2T, Tools & Equipment, or Miscellaneous.',
  '5. Comments are required when Category is Miscellaneous — same rule as the app\'s own claim form.',
  '6. Every row is imported as a pending claim, exactly like a Supervisor submitting it themselves — an Admin/CXO still needs to approve it and decide how it\'s funded on the Approvals page.',
  '7. Rows that look like a duplicate (same Supervisor, Project, Date, Category, and Amount as another row here or an existing record) are still imported, but flagged in the review step for a second look.',
  '8. Supervisor, Project, Date, Category, and Amount are always required.',
  '9. Dates should be in DD-MM-YYYY format, e.g. 01-08-2026.',
  '10. Save this file and upload it back on Expenses → Project when you’re done.',
]
