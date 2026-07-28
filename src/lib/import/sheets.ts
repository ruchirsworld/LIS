// Single source of truth for the historical-data-import workbook layout —
// shared between the sample-file generator and the upload parser so the
// column lists can never drift out of sync with each other.

export const SHEET_INSTRUCTIONS = 'Instructions'
export const SHEET_PROJECTS = 'Projects'
export const SHEET_INVOICES = 'Invoices'
export const SHEET_PAYMENTS = 'Payments Received'
export const SHEET_LOANS = 'Loans'
export const SHEET_LOAN_PAYMENTS = 'Loan Payments'

export const COLUMNS_PROJECTS = [
  'Client Name',
  'Project Name',
  'Cost Center',
  'Budget',
  'Contract Value (ex GST)',
  'Location',
  'Start Date (YYYY-MM-DD)',
  'Status (Active/Completed)',
] as const

export const COLUMNS_INVOICES = [
  'Invoice Number',
  'Client Name',
  'Project Name',
  'Amount',
  'GST %',
  'TDS %',
  'Invoice Date (YYYY-MM-DD)',
  'Due Days',
  'Status (Draft/Sent)',
] as const

export const COLUMNS_PAYMENTS = ['Invoice Number', 'Payment Date (YYYY-MM-DD)', 'Amount', 'Notes'] as const

export const COLUMNS_LOANS = [
  'Reference',
  'Lender Name',
  'Loan Type (Private/Bank)',
  'Principal Amount',
  'Interest Rate % (ROI)',
  'Date Taken (YYYY-MM-DD)',
  'Interest Payment Date (YYYY-MM-DD)',
  'Notes',
] as const

export const COLUMNS_LOAN_PAYMENTS = [
  'Loan Reference',
  'Payment Date (YYYY-MM-DD)',
  'Interest Paid',
  'Principal Paid',
  'Payment Mode (UPI/Cash/Bank)',
  'Notes',
] as const

export const EXAMPLE_ROW_PROJECTS = [
  'Ganesh Builders',
  'NH7 Mdn (Interm-01)',
  'Field / project site',
  '120000',
  '160000',
  'Dehradun (UK)',
  '2025-04-01',
  'Active',
]

export const EXAMPLE_ROW_INVOICES = [
  'GB/24-25/003',
  'Ganesh Builders',
  'NH7 Mdn (Interm-01)',
  '160000',
  '18',
  '2',
  '2025-04-10',
  '30',
  'Sent',
]

export const EXAMPLE_ROW_PAYMENTS = ['GB/24-25/003', '2025-05-01', '80000', 'Part payment via bank transfer']

export const EXAMPLE_ROW_LOANS = ['LOAN-1', 'Schrutir Jain', 'Private', '500000', '12', '2025-01-15', '', 'Private loan for working capital']

export const EXAMPLE_ROW_LOAN_PAYMENTS = ['LOAN-1', '2025-06-01', '5000', '20000', 'Bank', '']

export const INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Historical Data Import',
  '',
  '1. Fill in the sheets you have data for — leave the rest empty.',
  '2. Each sheet has one sample row. Delete it before adding your own rows, or the importer will try to import it too.',
  '3. "Invoice Number" on the Invoices sheet is your own real invoice number (or anything unique) — it gets saved as the invoice\'s number, and is also how a Payments Received row says which invoice it\'s paying. Spell it exactly the same on both sheets.',
  '4. "Reference" on the Loans sheet is a short code you make up, e.g. LOAN-1 — used only to link a Loan Payments row to its Loan, within this same file. It isn\'t stored anywhere else.',
  '5. If a Client, Project, or Lender name doesn’t already exist in the system, it will be created automatically.',
  '6. Dates should be in YYYY-MM-DD format, e.g. 2025-04-01.',
  '7. Save this file and upload it back on the Admin → Data import section when you’re done.',
]
