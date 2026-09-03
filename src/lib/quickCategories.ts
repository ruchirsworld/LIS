// Shared shape for every "Description → Sub Head" two-tap picker in the
// app (Trips, Admin expenses, and whatever else adopts the pattern later).
// A category with `options` has no sub-head of its own — tapping it just
// reveals its options, each a distinct real sub-head, so the actual pick
// happens one level down. A category without `options` is a direct one-tap
// entry (its own subHeadCode).

export type QuickOption = { label: string; subHeadCode: string }
export type QuickCategory = { label: string; subHeadCode?: string; options?: QuickOption[] }

export function groupLabelsOf(categories: QuickCategory[]): string[] {
  return categories.map((c) => c.label)
}

/** Resolves a (Description group, Sub Head option) pair — as typed in a
 * bulk-upload sheet — to the real sub-head code it maps to in the app. */
export function findSubHeadCode(categories: QuickCategory[], groupLabel: string, optionLabel: string): string | undefined {
  const group = categories.find((c) => c.label.trim().toLowerCase() === groupLabel.trim().toLowerCase())
  const option = group?.options?.find((o) => o.label.trim().toLowerCase() === optionLabel.trim().toLowerCase())
  return option?.subHeadCode
}
