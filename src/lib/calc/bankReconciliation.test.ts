import { describe, expect, it } from 'vitest'
import { bookBalanceAsOf, signoffStatus, summariseReconciliation, withinTolerance, type BankLine } from './bankReconciliation'

const lines: BankLine[] = [
  { id: 'a', date: '2026-10-01', description: 'Capital', deposit: 500000, withdrawal: 0 },
  { id: 'b', date: '2026-10-05', description: 'Receipt', deposit: 100000, withdrawal: 0 },
  { id: 'c', date: '2026-10-09', description: 'Vendor payment', deposit: 0, withdrawal: 40000 },
  { id: 'd', date: '2026-10-11', description: 'Cheque not yet presented', deposit: 0, withdrawal: 10000 },
]

describe('bank reconciliation', () => {
  it('agrees when every difference is a cheque or deposit not yet on the statement', () => {
    // Statement shows a, b and c only: 500000 + 100000 - 40000.
    const s = summariseReconciliation(lines, new Set(['a', 'b', 'c']), 560000)
    expect(s.bookBalance).toBe(550000)
    expect(s.unclearedWithdrawals).toBe(10000)
    expect(s.expectedStatementBalance).toBe(560000)
    expect(s.difference).toBe(0)
  })

  it('shows what is unexplained', () => {
    const s = summariseReconciliation(lines, new Set(['a', 'b', 'c']), 559000)
    expect(s.difference).toBe(-1000)
  })

  it('can look at the books as on the statement date', () => {
    const s = summariseReconciliation(lines, new Set(['a', 'b', 'c']), 560000, '2026-10-09')
    expect(s.bookBalance).toBe(560000)
    expect(s.unclearedWithdrawals).toBe(0)
    expect(s.difference).toBe(0)
  })
})

describe('saved reconciliations', () => {
  it('works out the books balance on a date', () => {
    expect(bookBalanceAsOf(lines, '2026-10-05')).toBe(600000)
    expect(bookBalanceAsOf(lines, '2026-10-31')).toBe(550000)
    expect(bookBalanceAsOf(lines, '2026-09-30')).toBe(0)
  })

  it('stays up to date while the books for that date are unchanged', () => {
    const r = signoffStatus({ statement_date: '2026-10-31', book_balance: 550000 }, lines)
    expect(r.upToDate).toBe(true)
  })

  it('goes stale when an entry dated within the period is added or changed afterwards', () => {
    const changed: BankLine[] = [...lines, { id: 'e', date: '2026-10-20', description: 'Late entry', deposit: 0, withdrawal: 500 }]
    const r = signoffStatus({ statement_date: '2026-10-31', book_balance: 550000 }, changed)
    expect(r.upToDate).toBe(false)
    expect(r.bookBalanceNow).toBe(549500)
  })

  it('is not affected by entries dated after the sign-off date', () => {
    const later: BankLine[] = [...lines, { id: 'f', date: '2026-11-15', description: 'Next month', deposit: 1000, withdrawal: 0 }]
    expect(signoffStatus({ statement_date: '2026-10-31', book_balance: 550000 }, later).upToDate).toBe(true)
  })
})

describe('the tolerance', () => {
  it('ignores a difference of up to 99 paise, either way, and no more', () => {
    expect(withinTolerance(0)).toBe(true)
    expect(withinTolerance(0.99)).toBe(true)
    expect(withinTolerance(-0.99)).toBe(true)
    expect(withinTolerance(1)).toBe(false)
    expect(withinTolerance(-179)).toBe(false)
  })
})
