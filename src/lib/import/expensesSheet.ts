// Column layout for the standalone Expenses import file — kept separate
// from sheets.ts (the combined Projects/Invoices/Vendor Bills/Loans
// workbook) since Expenses now has its own file. Mirrors the live "Add
// transaction" form exactly: cost center instead of category, Project only
// applies when the cost center is "Projects" (Client comes from the
// project, same as the live form — there's no separate Client column).

export const SHEET_EXPENSES = 'Expenses'

export const COLUMNS_EXPENSES = [
  'Cost Center (e.g. NAN, DDN, Projects, T&M)',
  'Project Name (required if Cost Center is Projects)',
  'Tags (e.g. #Rent #Fuel)',
  'Amount',
  'Date (YYYY-MM-DD)',
  'Remarks (optional)',
  'Payment Mode (UPI/Cash/Bank)',
  'Reimbursable (Yes/No)',
] as const

export const EXAMPLE_ROW_EXPENSES = ['DDN', '', '#Fuel', '1500', '2025-04-05', '', 'Cash', 'No']

export const EXPENSES_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Expenses Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Cost Center must match one of the cost centers already set up in Admin (e.g. NAN, DDN, Projects, T&M) — it is not created automatically.',
  '3. If Cost Center is "Projects", Project Name is required and must already exist in the system (create it first via Admin → Projects, or the Projects import file). The Client shown against the expense comes from the project automatically, same as in the app.',
  '4. Tags and Amount and Date are always required.',
  '5. Dates should be in YYYY-MM-DD format, e.g. 2025-04-01.',
  '6. Save this file and upload it back on the Admin → Data import section when you’re done.',
]
