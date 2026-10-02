// Column layout for the one common bulk-add-expenses sheet, covering all
// three cost centers (Admin, Trips, Project) in a single file — replaces
// the old Trips-only importer. Description + Sub Head mirror the app's own
// pickers: for Admin/Trips it's the two-tap Description group → option
// quick-tap; for Project it's Major head → Sub-head. The Sub Head dropdown
// in the file is dependent on both Cost Center and Description in the same
// row.

export const SHEET_EXPENSES = 'Entries'

export const COLUMNS_EXPENSES = [
  'Cost Center (Admin/Trips/Project)',
  'Project (Project rows only)',
  'Trip (Trips rows only)',
  'Description',
  'Sub Head (depends on Description)',
  'Date (DD-MM-YYYY)',
  'Amount',
  'Account (Kotak/CBI/Cash/Reimburse)',
  'Remarks (optional)',
] as const

export const EXAMPLE_ROW_EXPENSES = ['Admin', '', '', 'Office', 'Snacks', '05-04-2025', '500', 'Cash', '']

// Project's Description dropdown is one of these Major heads (fixed order —
// both the template's named-range positions and the importer's lookup rely
// on this exact array, so it lives here once instead of being duplicated).
export const PROJECT_MAJOR_HEADS = [
  { name: 'Employee & Labour Costs', code: 10 },
  { name: 'Materials & Consumables', code: 20 },
  { name: 'Transportation & Logistics', code: 40 },
]

export const EXPENSES_INSTRUCTIONS_LINES: string[] = [
  'Laavin Internal System — Expenses Import',
  '',
  '1. One sample row is included — delete it before adding your own rows, or the importer will try to import it too.',
  '2. Cost Center must be Admin, Trips, or Project — pick it first, since it determines which other columns apply.',
  '3. Project only applies to Project rows — pick an existing active project.',
  '4. Trip only applies to Trips rows — pick an existing trip ("Trip name — Traveler"). The trip\'s own project (if any) is used automatically; the Project column is ignored for Trips rows.',
  '5. Pick a Description next — the options depend on the Cost Center. For Admin/Trips this is the same Description group as the app\'s quick-tap picker (e.g. Transport, Office); the Sub Head dropdown then only offers the options under it. Some Admin groups (e.g. Misc) have no Sub Head of their own — leave Sub Head blank for those.',
  '6. For Project rows, Description is a Major head (Employee & Labour Costs / Materials & Consumables / Transportation & Logistics) and Sub Head is required — pick the actual sub-head under it.',
  '7. Account must be one of: Kotak, CBI, Cash, or Reimburse. Kotak/CBI must already exist as bank accounts.',
  '8. Cost Center, Description, Amount, Date, and Account are always required.',
  '9. Dates should be in DD-MM-YYYY format, e.g. 01-04-2025.',
  '10. Save this file and upload it back on the Expenses page when you’re done.',
]
