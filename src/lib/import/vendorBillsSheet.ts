// Column layout for bulk-adding Procurements (vendor bills) — mirrors
// VendorBillForm.tsx exactly: Sub Head is always one of Procurement's own
// 4 options under Materials & Consumables (no Major head picker, since
// Procurement only ever posts there), and Client is derived from Project,
// not a column of its own.

export const SHEET_VENDOR_BILLS = 'Bills'

export const COLUMNS_VENDOR_BILLS = [
  'Project',
  'Vendor',
  'Sub Head (Project Materials/Plants/Sub-Contract/Misc. Consumables)',
  'Bill date (YYYY-MM-DD)',
  'Bill description',
  'Bill value (₹)',
  'GST % (optional)',
  'Other cost (₹, optional)',
  'Remarks (required if Other cost > 0)',
] as const

// Fixed order — matches PROCUREMENT_SUB_HEAD_CODES in VendorBillForm.tsx.
export const PROCUREMENT_SUB_HEADS = [
  { name: 'Project Materials', code: '20.1' },
  { name: 'Plants', code: '20.7' },
  { name: 'Sub-Contract', code: '20.6' },
  { name: 'Misc. Consumables', code: '20.4' },
]

export const EXAMPLE_ROW_VENDOR_BILLS = ['', '', 'Project Materials', '2025-04-05', 'Cement and sand', '25000', '18', '0', '']

export const VENDOR_BILLS_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Procurements (Vendor Bills) Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Project and Vendor must already exist — pick them from the dropdowns.',
  '3. Sub Head must be one of: Project Materials, Plants, Sub-Contract, Misc. Consumables.',
  '4. Bill value is the amount before GST and Other cost — those are added on top, same as the live form.',
  '5. Remarks is required whenever Other cost is greater than 0.',
  '6. Project, Vendor, Sub Head, Bill date, Bill description, and Bill value are always required.',
  '7. Dates should be in YYYY-MM-DD format, e.g. 2025-04-01.',
  '8. Save this file and upload it back on the Procurements page when you’re done.',
]
