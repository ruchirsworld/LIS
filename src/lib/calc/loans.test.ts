import { describe, expect, it } from 'vitest'
import { DEFAULT_PRIVATE_LOAN_ROI, monthlyInterestDue, monthlyInterestOn } from './loans'

describe('private loan interest', () => {
  it('is preset to 24% a year, which is 2% a month', () => {
    expect(DEFAULT_PRIVATE_LOAN_ROI).toBe(24)
    expect(monthlyInterestOn(100000, 24)).toBe(2000)
  })

  it('follows whatever rate is entered', () => {
    expect(monthlyInterestOn(250000, 18)).toBe(3750)
    expect(monthlyInterestOn(100000, 0)).toBe(0)
    expect(monthlyInterestOn(100000, Number.NaN)).toBe(0)
  })

  it('rounds to the paisa', () => {
    expect(monthlyInterestOn(12345, 24)).toBe(246.9)
    expect(monthlyInterestOn(1001, 24)).toBe(20.02)
  })

  it('falls as the principal is repaid (reducing balance)', () => {
    const loan = { principal: 100000, roi_pct: 24, date_taken: '2026-01-01' }
    const paid = [{ date: '2026-02-01', principal_paid: 40000, interest_paid: 2000 }]
    expect(monthlyInterestDue(loan, [])).toBe(2000)
    expect(monthlyInterestDue(loan, paid)).toBe(1200)
  })
})
