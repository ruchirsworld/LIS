// Due/paid math for the Salary calculator — same shape as team tracker payments.

export interface SalaryPaymentRow {
  amount: number
}

export function salaryPaid(payments: SalaryPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function salaryDue(netPayable: number, payments: SalaryPaymentRow[]): number {
  return Math.max(0, netPayable - salaryPaid(payments))
}

export interface SalaryAdjustmentRow {
  amount: number
}

/** Net of all adjustments for a month — positive amounts are additions (bonus), negative are deductions. */
export function salaryAdjustmentsTotal(adjustments: SalaryAdjustmentRow[]): number {
  return adjustments.reduce((s, a) => s + Number(a.amount || 0), 0)
}

export function daysInMonth(month: string): number {
  const [y, mo] = month.split('-').map(Number)
  return new Date(y, mo, 0).getDate()
}

/** 'YYYY-MM' months fully or partially covered by [from, to]. Falls back to
 * the current month when either bound is open-ended (e.g. "All time") —
 * salary is inherently a monthly figure, so an unbounded range has no
 * natural multi-month meaning. */
export function monthsInRange(from: string | null, to: string | null): string[] {
  if (!from || !to) {
    const now = new Date()
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`]
  }
  const months: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [toY, toM] = to.slice(0, 7).split('-').map(Number)
  while (y < toY || (y === toY && m <= toM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return months
}
