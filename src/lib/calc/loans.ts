// Ported 1:1 from LIS_v1.0.html (loanPrincipalPaid/loanInterestPaid/
// loanOutstanding, and the simple-interest repayment suggestion).

export interface LoanRow {
  principal: number
  roi_pct: number
  date_taken: string | null
  interest_due_months: number
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

/**
 * Total interest currently owed = monthly interest (above) x the number of
 * months of interest the admin has marked as due. Stops mattering once the
 * principal is fully repaid, since monthlyInterestDue then returns 0.
 */
export function totalInterestDue(loan: LoanRow, payments: LoanPaymentRow[]): number {
  return monthlyInterestDue(loan, payments) * (Number(loan.interest_due_months) || 0)
}
