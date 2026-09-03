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
