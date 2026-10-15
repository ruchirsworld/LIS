import { describe, expect, it } from 'vitest'
import { allocateSettlement, chosenSettlementProblem, chosenToAllocations, oldestFirstChoices, type OutstandingExpense } from './expenses'

const owed: OutstandingExpense[] = [
  { id: 'fuel', due: 500 },
  { id: 'tickets', due: 3295 },
  { id: 'meals', due: 260, source: 'vendor_payment' },
]

describe('settling reimbursements', () => {
  it('goes oldest first by default, splitting across entries', () => {
    expect(allocateSettlement(3295, owed)).toEqual([
      { expenseId: 'fuel', amount: 500, source: 'expense' },
      { expenseId: 'tickets', amount: 2795, source: 'expense' },
    ])
  })

  it('can be given to one chosen entry instead', () => {
    const chosen = { tickets: '3295' }
    expect(chosenSettlementProblem(3295, chosen, owed)).toBeNull()
    expect(chosenToAllocations(chosen, owed)).toEqual([{ expenseId: 'tickets', amount: 3295, source: 'expense' }])
  })

  it('keeps the kind of entry (expense or vendor payment) on each row', () => {
    expect(chosenToAllocations({ meals: '260' }, owed)).toEqual([{ expenseId: 'meals', amount: 260, source: 'vendor_payment' }])
  })

  it('refuses amounts that do not add up to the payment', () => {
    expect(chosenSettlementProblem(3295, { tickets: '3000' }, owed)).toContain('295')
    expect(chosenSettlementProblem(3295, { tickets: '3295', fuel: '100' }, owed)).toContain('more than')
    expect(chosenSettlementProblem(3295, {}, owed)).toBe('Give the payment to at least one entry.')
  })

  it('refuses more than is due on an entry', () => {
    expect(chosenSettlementProblem(600, { fuel: '600' }, owed)).toContain('still due')
  })

  it('starts a hand-picked split from the oldest-first one', () => {
    expect(oldestFirstChoices(3295, owed)).toEqual({ fuel: '500', tickets: '2795' })
  })
})
