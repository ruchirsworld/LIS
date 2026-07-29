// Single source of truth for the historical-data-import workbook layout —
// shared between the sample-file generator and the upload parser so the
// column lists can never drift out of sync with each other.

export const SHEET_INSTRUCTIONS = 'Instructions'
export const SHEET_PROJECTS = 'Projects'
export const SHEET_INVOICES = 'Invoices'
export const SHEET_PAYMENTS = 'Payments Received'
export const SHEET_VENDOR_BILLS = 'Vendor Bills'
export const SHEET_VENDOR_BILL_PAYMENTS = 'Vendor Bill Payments'
export const SHEET_EXPENSES = 'Expenses'
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

export const COLUMNS_VENDOR_BILLS = [
  'Reference',
  'Vendor Name',
  'Bill Date (YYYY-MM-DD)',
  'Description',
  'Client Name (optional)',
  'Project Name (optional)',
  'Bill Value ex GST',
  'GST %',
] as const

export const COLUMNS_VENDOR_BILL_PAYMENTS = [
  'Bill Reference',
  'Payment Date (YYYY-MM-DD)',
  'Amount',
  'Payment Mode (UPI/NEFT/Cash)',
  'Notes',
] as const

export const COLUMNS_EXPENSES = [
  'Category (General/Purchase/Project)',
  'Tags (e.g. #Rent #Fuel)',
  'Cost Center (for General)',
  'Vendor Name (for Purchase)',
  'Client Name (for Project, optional)',
  'Project Name (for Project)',
  'Amount',
  'Date (YYYY-MM-DD)',
  'Payment Mode (UPI/Cash/Bank)',
  'Reimbursable (Yes/No)',
] as const

export const COLUMNS_LOANS = [
  'Reference',
  'Lender Name',
  'Loan Type (Private/Bank)',
  'Principal Amount',
  'Interest Rate % (ROI)',
  'Date Taken (YYYY-MM-DD)',
  'Interest Due (Months)',
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

export const EXAMPLE_ROW_VENDOR_BILLS = [
  'BILL-1',
  'Vidhi Enterprises',
  '2025-04-15',
  'Irrigation pipes',
  'Ganesh Builders',
  'NH7 Mdn (Interm-01)',
  '100000',
  '18',
]

export const EXAMPLE_ROW_VENDOR_BILL_PAYMENTS = ['BILL-1', '2025-05-01', '50000', 'NEFT', '']

export const EXAMPLE_ROW_EXPENSES = ['General', '#Fuel', 'DDN', '', '', '', '1500', '2025-04-05', 'Cash', 'No']

export const EXAMPLE_ROW_LOANS =['LOAN-1', 'Schrutir Jain', 'Private', '500000', '12', '2025-01-15', '', 'Private loan for working capital']

export const EXAMPLE_ROW_LOAN_PAYMENTS = ['LOAN-1', '2025-06-01', '5000', '20000', 'Bank', '']

export const INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Historical Data Import',
  '',
  '1. Fill in the sheets you have data for — leave the rest empty.',
  '2. Each sheet has one sample row. Delete it before adding your own rows, or the importer will try to import it too.',
  '3. "Invoice Number" on the Invoices sheet is your own real invoice number (or anything unique) — it gets saved as the invoice\'s number, and is also how a Payments Received row says which invoice it\'s paying. Spell it exactly the same on both sheets.',
  '4. "Reference" on the Vendor Bills sheet is a short code you make up, e.g. BILL-1 — used only to link a Vendor Bill Payments row to its bill, within this same file. It isn\'t stored anywhere else.',
  '5. "Reference" on the Loans sheet is a short code you make up, e.g. LOAN-1 — used only to link a Loan Payments row to its Loan, within this same file. It isn\'t stored anywhere else.',
  '6. On the Expenses sheet, only fill in the columns that match the Category you pick for that row: General needs Cost Center, Purchase needs Vendor Name, Project needs Project Name (Client Name is optional there).',
  '7. If a Client, Project, Vendor, or Lender name doesn’t already exist in the system, it will be created automatically.',
  '8. Dates should be in YYYY-MM-DD format, e.g. 2025-04-01.',
  '9. Save this file and upload it back on the Admin → Data import section when you’re done.',
]
