// Maps a LIS_Fields expense category (their `expense_categories.name`,
// exact text match) to the ERP2.0 sub-head code it's approved into.
export const FIELD_CATEGORY_TO_SUBHEAD_CODE: Record<string, string> = {
  Labor: '10.1', // Wages
  Transport: '10.5', // Staff Travel
  Food: '10.8', // Labour Food / Subsistence
  'Petrol / 2T': '30.6', // Fuel & Lubricants
  'Tools & Equipment': '30.4', // Tools Repair
  Miscellaneous: '60.5', // Site Miscellaneous
}

// Maps a LIS_Fields site name (their `sites.name`, exact text match) to the
// ERP2.0 project name it's the same place as — for sites named differently
// between the two apps, where a plain exact-name match in
// PendingClaimApprovals.tsx wouldn't find the match on its own.
export const FIELD_SITE_NAME_TO_PROJECT_NAME: Record<string, string> = {
  'NH7 - GB': 'NH7 (Median)',
}
