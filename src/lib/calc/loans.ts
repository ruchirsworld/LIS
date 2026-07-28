// Ported 1:1 from LIS_v1.0.html (loanPrincipalPaid/loanInterestPaid/
// loanOutstanding, and the simple-interest repayment suggestion).

export interface LoanRow {
  principal: number
  roi_pct: number
  date_taken: string | null
}

export interface LoanPaymentRow {
  date: string
  principal_paid: number | null
  interest_paid: number | null
}

export function loanPrincipalPaid(payments: LoanPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.principal_paid || 0), 0)
}

export function loanInterestPaid(payments: LoanPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.interest_paid || 0), 0)
}

export function loanOutstanding(loan: LoanRow, payments: LoanPaymentRow[]): number {
  return Math.max(0, Number(loan.principal || 0) - loanPrincipalPaid(payments))
}

/**
 * suggested_interest = outstanding_principal x (roi_pct / 100) x (days_since_last_payment_or_date_taken / 365)
 * Always just a starting suggestion for the repayment form — never enforced.
 */
export function suggestedInterest(loan: LoanRow, payments: LoanPaymentRow[]): number {
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date))
  const lastDate = sorted.length ? sorted[sorted.length - 1].date : loan.date_taken
  if (!lastDate) return 0
  const days = Math.max(0, Math.round((Date.now() - new Date(lastDate).getTime()) / 86400000))
  const outstanding = loanOutstanding(loan, payments)
  return outstanding * (Number(loan.roi_pct) || 0) / 100 * days / 365
}

/**
 * Reducing-balance monthly interest: outstanding_principal x (roi_pct / 100) / 12.
 * Both Private Party and Bank loans use this formula — it automatically
 * recalculates as principal is repaid. This is the at-a-glance "interest due
 * this month" figure; suggestedInterest above stays the day-precise amount
 * used when actually recording a payment.
 */
export function monthlyInterestDue(loan: LoanRow, payments: LoanPaymentRow[]): number {
  const outstanding = loanOutstanding(loan, payments)
  return (outstanding * (Number(loan.roi_pct) || 0)) / 100 / 12
}
