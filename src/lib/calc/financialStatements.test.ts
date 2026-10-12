import { describe, expect, it } from 'vitest'
import { buildBalanceSheet, buildProfitAndLoss, fyLabel, fyRange, fyStartYearOf, netProfitOf, type GlBalance } from './financialStatements'

const acc = (code: string, account_type: string, name: string, total_debit: number, total_credit: number): GlBalance => ({
  code,
  name,
  account_type,
  normal_balance: account_type === 'asset' || account_type === 'expense' ? 'debit' : 'credit',
  sort_order: 0,
  total_debit,
  total_credit,
})

// A small but complete set of books: capital in, an invoice raised, an expense paid.
const thisYear: GlBalance[] = [
  acc('1020', 'asset', 'Bank', 500000, 100000),
  acc('1030', 'asset', 'Accounts Receivable', 118000, 0),
  acc('3010', 'equity', "Partners' capital", 0, 500000),
  acc('2030', 'liability', 'GST payable', 0, 18000),
  acc('4010', 'income', 'Revenue', 0, 100000),
  acc('5020', 'expense', 'Materials', 100000, 0),
]

describe('financial year helpers', () => {
  it('runs April to March', () => {
    expect(fyStartYearOf('2026-03-31')).toBe(2025)
    expect(fyStartYearOf('2026-04-01')).toBe(2026)
    expect(fyLabel(2025)).toBe('2025-26')
    expect(fyRange(2025)).toEqual({ from: '2025-04-01', to: '2026-03-31' })
  })
})

describe('profit and loss', () => {
  it('is income less expenses', () => {
    const { netProfit, lines } = buildProfitAndLoss(thisYear, [])
    expect(netProfit.cur).toBe(0)
    expect(netProfitOf([acc('4010', 'income', 'Revenue', 0, 500), acc('5010', 'expense', 'Wages', 200, 0)])).toBe(300)
    expect(lines.find((l) => l.label === 'Revenue from operations')?.cur).toBe(100000)
    expect(lines.find((l) => l.label === 'Materials')?.cur).toBe(100000)
  })

  it('leaves out expense lines that are nil in both years', () => {
    const { lines } = buildProfitAndLoss([acc('5010', 'expense', 'Wages', 0, 0), acc('4010', 'income', 'Revenue', 0, 10)], [])
    expect(lines.some((l) => l.label === 'Wages')).toBe(false)
  })
})

describe('balance sheet', () => {
  it('balances when the ledger balances', () => {
    // Debits = credits across the ledger, so assets must equal equity plus liabilities.
    const ledger: GlBalance[] = [
      acc('1020', 'asset', 'Bank', 500000, 100000),
      acc('1030', 'asset', 'Accounts Receivable', 118000, 0),
      acc('3010', 'equity', "Partners' capital", 0, 500000),
      acc('2030', 'liability', 'GST payable', 0, 18000),
      acc('4010', 'income', 'Revenue', 0, 100000),
      acc('5020', 'expense', 'Materials', 100000, 0),
    ]
    const dr = ledger.reduce((s, r) => s + r.total_debit, 0)
    const cr = ledger.reduce((s, r) => s + r.total_credit, 0)
    expect(dr).toBe(cr)
    const { totals } = buildBalanceSheet(ledger, [], { cur: netProfitOf(ledger), prev: 0 })
    expect(totals.assets.cur).toBe(518000)
    expect(totals.funds.cur).toBe(518000)
  })

  it('splits profit brought forward from profit for the year', () => {
    const cum = [acc('1020', 'asset', 'Bank', 300, 0), acc('4010', 'income', 'Revenue', 0, 300)]
    const { lines } = buildBalanceSheet(cum, [], { cur: 100, prev: 0 })
    expect(lines.find((l) => l.label === 'Profit brought forward')?.cur).toBe(200)
    expect(lines.find((l) => l.label === 'Profit for the year')?.cur).toBe(100)
  })
})
