import { describe, expect, it } from 'vitest'
import { spendByAccount } from './spendByAccount'

const banks = [
  { id: 'k', name: 'Kotak' },
  { id: 'c', name: 'CBI' },
  { id: 'h', name: 'HDFC' },
]
const row = (amount: number, over: Partial<{ reimbursable: boolean; paid_from_imprest: boolean; bank_account_id: string | null }> = {}) => ({
  amount,
  reimbursable: false,
  paid_from_imprest: false,
  bank_account_id: null,
  ...over,
})

describe('spend by account', () => {
  it('splits by Kotak, Cash, CBI and Reimbursement, in that order', () => {
    const r = spendByAccount([row(100, { bank_account_id: 'k' }), row(50), row(30, { bank_account_id: 'c' }), row(20, { reimbursable: true }), row(10, { bank_account_id: 'k' })], banks)
    expect(r.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Kotak', 110],
      ['Cash', 50],
      ['CBI', 30],
      ['Reimbursement', 20],
    ])
    expect(r.total).toBe(210)
  })

  it('always lists the four, at nil when unused', () => {
    expect(spendByAccount([], banks).lines.map((l) => [l.label, l.amount])).toEqual([
      ['Kotak', 0],
      ['Cash', 0],
      ['CBI', 0],
      ['Reimbursement', 0],
    ])
  })

  it('a reimbursable entry counts as reimbursement even if it names a bank', () => {
    const r = spendByAccount([row(40, { reimbursable: true, bank_account_id: 'k' })], banks)
    expect(r.lines.find((l) => l.label === 'Reimbursement')?.amount).toBe(40)
    expect(r.lines.find((l) => l.label === 'Kotak')?.amount).toBe(0)
  })

  it('adds other banks and imprest only when used, and the lines add up to the total', () => {
    const rows = [row(15.25, { bank_account_id: 'h' }), row(5, { paid_from_imprest: true }), row(1, { bank_account_id: 'gone' })]
    const r = spendByAccount(rows, banks)
    expect(r.lines.map((l) => l.label)).toEqual(['Kotak', 'Cash', 'CBI', 'Reimbursement', 'HDFC', 'Imprest', 'Other bank'])
    expect(r.lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(r.total, 2)
    expect(r.total).toBe(21.25)
  })
})
