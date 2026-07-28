// Due/paid math for Team Tracker entries — same shape as invoice/vendor-bill payments.

export interface TeamTrackerPaymentRow {
  amount: number
}

export function ttPaid(payments: TeamTrackerPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function ttDue(total: number | null, payments: TeamTrackerPaymentRow[]): number {
  return Math.max(0, Number(total || 0) - ttPaid(payments))
}
