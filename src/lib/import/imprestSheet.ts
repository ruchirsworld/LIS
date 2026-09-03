// Column layout for the Site Imprest bulk-import sheet — one row per
// advance given to, or return received from, a Supervisor's site float.

export const SHEET_IMPREST = 'Imprest'

export const COLUMNS_IMPREST = [
  'Supervisor',
  'Date (DD-MM-YYYY)',
  'Kind (Advance/Return)',
  'Amount',
  'Account (Kotak/CBI/Cash)',
  'Remarks (optional)',
] as const

export const EXAMPLE_ROW_IMPREST = ['', '01-08-2026', 'Advance', '2000', 'Kotak', '']

export const IMPREST_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Site Imprest Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Supervisor must match an existing Supervisor by name exactly.',
  '3. Kind must be Advance (cash handed to the supervisor) or Return (cash handed back).',
  '4. Account must be Kotak, CBI, or Cash. Kotak/CBI must already exist as bank accounts.',
  '5. Supervisor, Date, Kind, Amount, and Account are always required.',
  '6. Dates should be in DD-MM-YYYY format, e.g. 01-08-2026.',
  '7. Save this file and upload it back on HR → Imprest when you’re done.',
]
