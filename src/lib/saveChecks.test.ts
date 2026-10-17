import { describe, expect, it } from 'vitest'
import { amountWarning, dateWarnings, daysBetween, duplicateWindow, entrySentence } from './saveChecks'

describe('dateWarnings', () => {
  it('is quiet for today and recent dates', () => {
    expect(dateWarnings('2026-10-17', '2026-10-17')).toEqual([])
    expect(dateWarnings('2026-09-17', '2026-10-17')).toEqual([])
  })
  it('warns about a future date', () => {
    expect(dateWarnings('2026-10-19', '2026-10-17')[0].kind).toBe('future-date')
  })
  it('warns about a date more than 30 days back, not 30 exactly', () => {
    expect(dateWarnings('2026-09-16', '2026-10-17')[0].kind).toBe('old-date')
    expect(dateWarnings('2026-09-17', '2026-10-17')).toEqual([])
  })
  it('counts days across month ends', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
  })
})

describe('amountWarning', () => {
  it('needs at least five earlier entries', () => {
    expect(amountWarning(100000, [100, 100, 100, 100])).toEqual([])
  })
  it('warns at three times the average or more', () => {
    const earlier = [100, 100, 100, 100, 100]
    expect(amountWarning(299, earlier)).toEqual([])
    expect(amountWarning(300, earlier)[0].kind).toBe('large-amount')
  })
  it('ignores zero and bad amounts', () => {
    expect(amountWarning(1000, [0, 0, 0, 0, 0, NaN])).toEqual([])
  })
})

describe('duplicateWindow', () => {
  it('is two days either side', () => {
    expect(duplicateWindow('2026-10-15')).toEqual({ from: '2026-10-13', to: '2026-10-17' })
    expect(duplicateWindow('2026-03-01')).toEqual({ from: '2026-02-27', to: '2026-03-03' })
  })
})

describe('entrySentence', () => {
  it('joins the parts and skips empty ones', () => {
    expect(entrySentence(['Expense ₹5,000', '15 Oct', false, null, 'Project: X'])).toBe('Expense ₹5,000 · 15 Oct · Project: X')
  })
})
