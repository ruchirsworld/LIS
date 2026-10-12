import { describe, expect, it } from 'vitest'
import { summariseReconciliation, type BankLine } from './bankReconciliation'

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
