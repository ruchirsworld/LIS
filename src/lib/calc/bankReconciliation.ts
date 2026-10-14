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
