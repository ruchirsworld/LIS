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

/** Calendar months between a date and today (like Excel's DATEDIF(start, TODAY(), "m")). */
function monthsElapsed(fromDateStr: string, today: Date): number {
  const from = new Date(fromDateStr)
  let months = (today.getFullYear() - from.getFullYear()) * 12 + (today.getMonth() - from.getMonth())
  if (today.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

/** Most recent payment date that included an interest component, else the loan's start date. */
export function lastInterestPaymentDate(loan: LoanRow, payments: LoanPaymentRow[]): string | null {
  const interestPayments = payments.filter((p) => Number(p.interest_paid || 0) > 0)
  if (interestPayments.length === 0) return loan.date_taken
  return interestPayments.reduce((latest, p) => (p.date > latest ? p.date : latest), interestPayments[0].date)
}

/** Months of interest currently outstanding, counted automatically from the last interest
 * payment (or the loan's start date) up to today — no manual entry needed. */
export function monthsInterestDue(loan: LoanRow, payments: LoanPaymentRow[]): number {
  const from = lastInterestPaymentDate(loan, payments)
  if (!from) return 0
  return monthsElapsed(from, new Date())
}

/**
 * Total interest currently owed = monthly interest (above) x months of interest due (above).
 * Stops mattering once the principal is fully repaid, since monthlyInterestDue then returns 0.
 */
export function totalInterestDue(loan: LoanRow, payments: LoanPaymentRow[]): number {
  return monthlyInterestDue(loan, payments) * monthsInterestDue(loan, payments)
}
