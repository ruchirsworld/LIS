import { billTotal } from './vendorBills'

// Money movements for the dashboard's "This period" cards: what was spent, paid and received between two dates.

export interface PeriodRange {
  from?: string | null
  to?: string | null
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** True when a YYYY-MM-DD date is inside the range. No range, or an open end, means no limit on that side. */
export function inRange(date: string, range: PeriodRange | null | undefined): boolean {
  if (!date) return false
  return (!range?.from || date >= range.from) && (!range?.to || date <= range.to)
}

export interface GroupTotal {
  key: string
  count: number
  amount: number
}

/** Totals by a label (a project, a vendor, a person ...), biggest first. */
export function totalsBy<T>(rows: T[], keyOf: (r: T) => string, amountOf: (r: T) => number): GroupTotal[] {
  const map = new Map<string, GroupTotal>()
  for (const r of rows) {
    const key = keyOf(r)
    const cur = map.get(key) ?? { key, count: 0, amount: 0 }
    cur.count += 1
    cur.amount += Number(amountOf(r) || 0)
    map.set(key, cur)
  }
  return [...map.values()].map((g) => ({ ...g, amount: round2(g.amount) })).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))
}

export const sumOf = <T,>(rows: T[], amountOf: (r: T) => number) => round2(rows.reduce((s, r) => s + Number(amountOf(r) || 0), 0))

/** What was paid to vendors in the period: payments on bills, plus advances paid ahead of bills. A payment made
 * "from an advance" only moves money that was already paid as the advance, so it is not counted a second time. */
export function vendorPaidTotals(
  payments: { amount: number; date: string; payment_mode: string | null }[],
  advances: { amount: number; date: string }[],
  range: PeriodRange | null
): { bills: number; advances: number; total: number } {
  const bills = sumOf(payments.filter((p) => p.payment_mode !== 'Advance' && inRange(p.date, range)), (p) => p.amount)
  const adv = sumOf(advances.filter((a) => inRange(a.date, range)), (a) => a.amount)
  return { bills, advances: adv, total: round2(bills + adv) }
}

/** What one project cost in the period (or all of it when `range` is null): approved expenses booked to it, and its vendor
 * bills. Wages are worked out separately from attendance. */
export function projectSpend(
  projectId: string,
  expenses: { project_id: string | null; amount: number; date: string }[],
  bills: { project_id: string | null; date: string | null; amount: number; gst_pct: number | null; other_cost?: number | null }[],
  range: PeriodRange | null
): { expenses: number; bills: number; total: number } {
  const exp = sumOf(expenses.filter((e) => e.project_id === projectId && inRange(e.date, range)), (e) => e.amount)
  const billRows = bills.filter((b) => b.project_id === projectId && !!b.date && inRange(b.date as string, range))
  const bill = sumOf(billRows, (b) => billTotal(b))
  return { expenses: exp, bills: bill, total: round2(exp + bill) }
}
