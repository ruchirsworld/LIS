// Description options for Admin (no cost center) expenses — same two-tap
// pattern as Trips (see tripQuickCategories.ts): pick a Description group,
// then a Sub Head option under it. Covers Major Heads 50/70/80/90/100 —
// Project- and Trip-linked spend have their own separate flows. Each
// option's own subHeadCode carries its real accounting classification,
// independent of which group it's surfaced under (e.g. Fees is Major Head
// 80 even though it's grouped here under Finance for quick entry).
import type { QuickCategory } from './quickCategories'

export const ADMIN_QUICK_CATEGORIES: QuickCategory[] = [
  {
    label: 'Office',
    options: [
      { label: 'NAN', subHeadCode: '50.10' },
      { label: 'DDN', subHeadCode: '50.11' },
      { label: 'Snacks', subHeadCode: '50.5' },
      { label: 'Consumables', subHeadCode: '20.2' },
      { label: 'Misc.', subHeadCode: '100.1' },
    ],
  },
  {
    label: 'BD',
    options: [
      { label: 'Digital', subHeadCode: '70.6' },
      { label: 'Marketing', subHeadCode: '70.1' },
      { label: 'PR', subHeadCode: '70.3' },
      { label: 'Misc.', subHeadCode: '100.1' },
    ],
  },
  {
    // Interest & Finance Cost (90.2) is deliberately not an option here —
    // loan interest is recorded only through Loans → Record payment, which
    // posts to that sub-head automatically. Repeating it here would double
    // -count interest against a loan already tracked there. Fees stays
    // classified under Major Head 80 (Professional & Statutory) for
    // accounting purposes — it's just surfaced here for quick entry.
    label: 'Finance',
    options: [
      { label: 'Bank Charges', subHeadCode: '90.1' },
      { label: 'Other Charges', subHeadCode: '90.4' },
      { label: 'Fees', subHeadCode: '80.5' },
    ],
  },
  { label: 'Misc', subHeadCode: '100.1' },
]
