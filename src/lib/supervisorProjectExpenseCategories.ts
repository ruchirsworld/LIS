// The fixed category set for a Supervisor's Project expense entry — mirrors
// LIS_Fields' ExpensesPage.tsx layout exactly (Labor as headcount × rate,
// then Transport/Food/Petrol-2T/Tools & Equipment/Miscellaneous as flat
// amounts, Miscellaneous requiring a comment), remapped onto ERP2.0's own
// Chart of Accounts sub-heads instead of LIS_Fields' expense_categories.
export interface FixedExpenseCategory {
  key: string
  label: string
  subHeadCode: string
}

export const LABOUR_SUB_HEAD_CODE = '10.1' // Labour Salary / Wages

export const FIXED_EXPENSE_CATEGORIES: FixedExpenseCategory[] = [
  { key: 'transport', label: 'Transport', subHeadCode: '40.1' }, // Project Transportation
  { key: 'food', label: 'Food', subHeadCode: '10.8' }, // Labour Food / Subsistence
  { key: 'petrol', label: 'Petrol/2T', subHeadCode: '30.6' }, // Fuel & Lubricants
  { key: 'tools', label: 'Tools & Equipment', subHeadCode: '30.3' }, // Tools Purchase
  { key: 'misc', label: 'Miscellaneous', subHeadCode: '20.4' }, // Misc. Consumables
]

export const MISC_CATEGORY_KEY = 'misc'
