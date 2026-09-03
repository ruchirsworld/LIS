// Column layout for bulk-adding Invoice receipts — mirrors
// InvoiceReceiptForm.tsx: Client is required, Invoice is an optional
// refinement (leave it blank to auto-adjust against the client's oldest
// outstanding invoice, same FIFO behavior as the live "Record receipts" form).

export const SHEET_RECEIPTS = 'Receipts'

export const COLUMNS_RECEIPTS = [
  'Client',
  'Invoice no. (optional)',
  'Date (DD-MM-YYYY)',
  'Amount (₹)',
] as const

export const EXAMPLE_ROW_RECEIPTS = ['', '', '01-08-2026', '25000']

export const RECEIPTS_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Invoice Receipts Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Client must already exist — pick it from the dropdown.',
  '3. Invoice no. is optional — leave it blank to auto-adjust against the client\'s oldest outstanding invoice (FIFO), same as the live "Record receipts" form. If given, it must match an existing invoice for that client, by invoice number or by its system ID.',
  '4. Client, Date, and Amount are always required.',
  '5. Dates should be in DD-MM-YYYY format, e.g. 01-08-2026.',
  '6. Rows that look like a duplicate (same invoice, date, and amount as another row here or an existing receipt) are still imported, but flagged in the review step for a second look.',
  '7. Save this file and upload it back on the Invoices page when you’re done.',
]
