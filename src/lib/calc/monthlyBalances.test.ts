import { describe, expect, it } from 'vitest'
import { buildMonthlyCheck, differenceHint, monthStart, monthsBetween, nextMonth } from './monthlyBalances'

describe('months', () => {
  it('finds the month a date is in and the next one', () => {
    expect(monthStart('2026-10-15')).toBe('2026-10-01')
    expect(nextMonth('2026-12-01')).toBe('2027-01-01')
    expect(nextMonth('2026-10-01')).toBe('2026-11-01')
  })

  it('lists every month from one date to another, across a year end', () => {
    expect(monthsBetween('2026-11-20', '2027-02-03')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
    expect(monthsBetween('2026-10-05', '2026-10-31')).toEqual(['2026-10-01'])
  })
})

describe('monthly check: typed opening against the one the app calculates', () => {
  // The books start on 1 Aug with 5,000. August: +1,000 -400. September: +500.
  const lines = [
    { date: '2026-08-01', debit: 5000, credit: 0, isOpening: true },
    { date: '2026-08-05', debit: 1000, credit: 0 },
    { date: '2026-08-20', debit: 0, credit: 400 },
    { date: '2026-09-02', debit: 500, credit: 0 },
  ]
  const months = ['2026-08-01', '2026-09-01', '2026-10-01']

  it('calculates each month opening from the account opening balance plus everything before it', () => {
    const rows = buildMonthlyCheck(months, lines, new Map())
    expect(rows.map((r) => r.calculatedOpening)).toEqual([5000, 5600, 6100])
  })

  it('shows no difference, and an agreeing month, when the statement says the same', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 5600], ['2026-10-01', 6100]]))
    expect(rows[0]).toMatchObject({ statementOpening: 5000, calculatedOpening: 5000, openingDifference: 0, monthDifference: 0, status: 'agrees' })
    expect(rows[1]).toMatchObject({ openingDifference: 0, status: 'agrees' })
  })

  it('points at the month where the difference appears', () => {
    // The bank has 400 more at 1 Sep than the entries explain: something is wrong in August.
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 6000], ['2026-10-01', 6500]]))
    expect(rows[0]).toMatchObject({ openingDifference: 0, monthDifference: 400, status: 'differs' })
    // the difference carries forward unchanged, so September itself is fine
    expect(rows[1]).toMatchObject({ openingDifference: 400, monthDifference: 0, status: 'agrees' })
    expect(differenceHint(400)).toContain('more than the entries explain')
    expect(differenceHint(-400)).toContain('less than the entries explain')
  })

  it('waits when the next month has no typed balance, and asks for one when the month has none', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 5600]]))
    expect(rows[1].status).toBe('waiting')
    expect(rows[2].status).toBe('no-opening')
    expect(rows[2].openingDifference).toBeNull()
  })

  it('checks each month on its own, so they can be typed in any order', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-09-01', 5600], ['2026-10-01', 6100]]))
    expect(rows[0].status).toBe('no-opening')
    expect(rows[1].status).toBe('agrees')
  })

  it('counts an account opening balance dated mid-month from that day, and not before it', () => {
    const l = [{ date: '2026-08-15', debit: 3000, credit: 0, isOpening: true }]
    const rows = buildMonthlyCheck(['2026-08-01', '2026-09-01'], l, new Map())
    expect(rows.map((r) => r.calculatedOpening)).toEqual([0, 3000])
  })
})
