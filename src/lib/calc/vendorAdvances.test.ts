import { describe, expect, it } from 'vitest'
import { advanceBalance, advanceUsed } from './vendorAdvances'

describe('vendor advances', () => {
  const payments = [
    { advance_id: 'a1', amount: 6000 },
    { advance_id: 'a1', amount: 1500.5 },
    { advance_id: 'a2', amount: 100 },
    { advance_id: null, amount: 999 },
  ]

  it('adds up what an advance has been used for', () => {
    expect(advanceUsed({ id: 'a1', amount: 10000 }, payments)).toBe(7500.5)
    expect(advanceUsed({ id: 'a3', amount: 10000 }, payments)).toBe(0)
  })

  it('gives what is left, never below nil', () => {
    expect(advanceBalance({ id: 'a1', amount: 10000 }, payments)).toBe(2499.5)
    expect(advanceBalance({ id: 'a2', amount: 100 }, payments)).toBe(0)
    expect(advanceBalance({ id: 'a2', amount: 50 }, payments)).toBe(0)
  })
})
