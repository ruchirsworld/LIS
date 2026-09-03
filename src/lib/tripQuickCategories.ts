// Description options for trip expense entries — shared between the live
// "Add transaction" form (ExpenseForm) and the bulk-upload Excel template,
// so the two never drift apart.

import { groupLabelsOf, findSubHeadCode, type QuickCategory, type QuickOption } from './quickCategories'

export type { QuickCategory as TripQuickCategory, QuickOption as TripQuickOption }

export const TRIP_QUICK_CATEGORIES: QuickCategory[] = [
  {
    label: 'Transport',
    options: [
      { label: 'Fuel', subHeadCode: '40.5' },
      { label: 'Repairs', subHeadCode: '40.6' },
      { label: 'Tickets', subHeadCode: '40.7' },
      { label: 'Misc.', subHeadCode: '100.1' },
    ],
  },
  {
    label: 'Consumables',
    options: [
      { label: 'Meals', subHeadCode: '20.3' },
      { label: 'Groceries', subHeadCode: '50.5' },
      { label: 'Leisure', subHeadCode: '100.2' },
    ],
  },
  {
    label: 'Other',
    options: [
      { label: 'Lodging', subHeadCode: '10.7' },
      { label: 'Misc.', subHeadCode: '100.1' },
    ],
  },
]

/** Top-level Description group labels (Transport / Consumables / Other) —
 * every group in the current taxonomy has its own set of Sub Head options,
 * so this is just the group labels. */
export function tripDescriptionLabels(): string[] {
  return groupLabelsOf(TRIP_QUICK_CATEGORIES)
}

/** Resolves a (Description group, Sub Head option) pair — as typed in the
 * bulk-upload sheet — to the real sub-head code it maps to in the app. */
export function findTripSubHeadCode(groupLabel: string, optionLabel: string): string | undefined {
  return findSubHeadCode(TRIP_QUICK_CATEGORIES, groupLabel, optionLabel)
}
