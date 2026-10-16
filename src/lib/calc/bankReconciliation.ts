// Bank reconciliation: tick the ledger lines that appear on the bank
// statement, and the books and the statement should agree.

export interface BankLine {
  id: string
  date: string
  description: string
  /** Money in (a receipt, a deposit). */
  deposit: number
  /** Money out (a payment, a withdrawal). */
  withdrawal: number
  /** The kind of record this line came from (an expense, a transfer ...) and its id, so it can be opened. */
  sourceTable?: string | null
  sourceId?: string | null
  /** What the person typed when they made the entry (description, vendor, note, reference), read from the original record. */
  detail?: string
}

export interface ReconciliationSummary {
  /** What the ledger says the account holds. */
  bookBalance: number
  /** Deposits recorded in the books that have not yet appeared on the statement. */
  unclearedDeposits: number
  /** Payments recorded in the books that have not yet appeared on the statement. */
  unclearedWithdrawals: number
  /** What the statement should show if every difference is explained. */
  expectedStatementBalance: number
  /** Statement balance entered, less the expected one. Nil when everything agrees. */
  difference: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Reconciliation ignores a difference of up to 99 paise: an amount that is off by less than a rupee still matches,
 * and a statement within 99 paise of the books counts as agreeing. */
export const AMOUNT_TOLERANCE = 0.99

/** True when a difference is small enough to be ignored in reconciliation. */
export const withinTolerance = (difference: number) => Math.abs(difference) <= AMOUNT_TOLERANCE + 1e-9

/** What the books say the account holds on a date: money in less money out, up to and including it. */
export function bookBalanceAsOf(lines: BankLine[], date: string): number {
  return round2(lines.filter((l) => l.date <= date).reduce((s, l) => s + l.deposit - l.withdrawal, 0))
}

export interface SignoffStatus {
  /** The books for that date still say what they said when it was signed off. */
  upToDate: boolean
  /** What the books say now, for that date. */
  bookBalanceNow: number
}

/** A saved reconciliation goes stale if entries dated up to its date were added, changed or removed afterwards. */
export function signoffStatus(signoff: { statement_date: string; book_balance: number }, lines: BankLine[]): SignoffStatus {
  const bookBalanceNow = bookBalanceAsOf(lines, signoff.statement_date)
  return { upToDate: Math.abs(bookBalanceNow - Number(signoff.book_balance)) < 0.005, bookBalanceNow }
}

export function summariseReconciliation(lines: BankLine[], cleared: Set<string>, statementBalance: number, upTo?: string): ReconciliationSummary {
  const counted = upTo ? lines.filter((l) => l.date <= upTo) : lines
  const net = (l: BankLine) => l.deposit - l.withdrawal
  const bookBalance = round2(counted.reduce((s, l) => s + net(l), 0))
  const unclearedDeposits = round2(counted.filter((l) => !cleared.has(l.id)).reduce((s, l) => s + l.deposit, 0))
  const unclearedWithdrawals = round2(counted.filter((l) => !cleared.has(l.id)).reduce((s, l) => s + l.withdrawal, 0))
  const expectedStatementBalance = round2(bookBalance - unclearedDeposits + unclearedWithdrawals)
  return {
    bookBalance,
    unclearedDeposits,
    unclearedWithdrawals,
    expectedStatementBalance,
    difference: round2(statementBalance - expectedStatementBalance),
  }
}
