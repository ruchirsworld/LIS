// Column layout for bulk-adding Invoices — mirrors InvoiceForm.tsx: Client
// is required, Project is an optional refinement that must belong to that
// client, and Invoice date only applies once Status is Sent (a Draft
// invoice has no date yet, same as the live form).

export const SHEET_INVOICES = 'Invoices'

export const COLUMNS_INVOICES = [
  'Client',
  'Project (optional)',
  'Invoice no. (optional)',
  'Amount (₹)',
  'Due in days (optional)',
  'GST % (optional)',
  'TDS % (optional)',
  'Status (Draft/Sent)',
  'Invoice date (required only if Sent)',
] as const

export const INVOICE_STATUSES = ['Draft', 'Sent'] as const

export const EXAMPLE_ROW_INVOICES = ['', '', '', '50000', '30', '18', '2', 'Draft', '']

export const INVOICES_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Invoices Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Client must already exist — pick it from the dropdown.',
  '3. Project is optional, but if given it must belong to the Client in that row.',
  '4. Invoice no. is the customer-facing number you assign — leave it blank to only track this by the system\'s own internal ID.',
  '5. Status must be Draft or Sent. Invoice date only applies once Status is Sent — leave it blank for Draft rows.',
  '6. Client, Amount, and Status are always required.',
  '7. Dates should be in YYYY-MM-DD format, e.g. 2025-04-01.',
  '8. Save this file and upload it back on the Invoices page when you’re done.',
]
