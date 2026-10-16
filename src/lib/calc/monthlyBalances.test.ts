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
  const start = { date: '2026-08-01', amount: 5000 }
  const lines = [
    { date: '2026-08-05', debit: 1000, credit: 0 },
    { date: '2026-08-20', debit: 0, credit: 400 },
    { date: '2026-09-02', debit: 500, credit: 0 },
  ]
  const months = ['2026-08-01', '2026-09-01', '2026-10-01']

  it('calculates each month opening from the account opening balance plus everything before it', () => {
    const rows = buildMonthlyCheck(months, lines, new Map(), start)
    expect(rows.map((r) => r.calculatedOpening)).toEqual([5000, 5600, 6100])
  })

  it('shows no difference, and an agreeing month, when the statement says the same', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 5600], ['2026-10-01', 6100]]), start)
    expect(rows[0]).toMatchObject({ statementOpening: 5000, calculatedOpening: 5000, openingDifference: 0, monthDifference: 0, status: 'agrees' })
    expect(rows[1]).toMatchObject({ openingDifference: 0, status: 'agrees' })
  })

  it('points at the month where the difference appears', () => {
    // The bank has 400 more at 1 Sep than the entries explain: something is wrong in August.
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 6000], ['2026-10-01', 6500]]), start)
    expect(rows[0]).toMatchObject({ openingDifference: 0, monthDifference: 400, status: 'differs' })
    // the difference carries forward unchanged, so September itself is fine
    expect(rows[1]).toMatchObject({ openingDifference: 400, monthDifference: 0, status: 'agrees' })
    expect(differenceHint(400)).toContain('more than the entries explain')
    expect(differenceHint(-400)).toContain('less than the entries explain')
  })

  it('waits when the next month has no typed balance, and asks for one when the month has none', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-08-01', 5000], ['2026-09-01', 5600]]), start)
    expect(rows[1].status).toBe('waiting')
    expect(rows[2].status).toBe('no-opening')
    expect(rows[2].openingDifference).toBeNull()
  })

  it('checks each month on its own, so they can be typed in any order', () => {
    const rows = buildMonthlyCheck(months, lines, new Map([['2026-09-01', 5600], ['2026-10-01', 6100]]), start)
    expect(rows[0].status).toBe('no-opening')
    expect(rows[1].status).toBe('agrees')
  })

  it('works backward from an opening balance for the months before it, so the newest month can be done first', () => {
    // The books start on 1 Oct with 6,100. September's entries: +500. So the balance on 1 Sep was 5,600.
    const rows = buildMonthlyCheck(['2026-09-01', '2026-10-01'], lines.slice(-1), new Map([['2026-09-01', 5600], ['2026-10-01', 6100]]), { date: '2026-10-01', amount: 6100 })
    expect(rows.map((r) => r.calculatedOpening)).toEqual([5600, 6100])
    expect(rows[0]).toMatchObject({ openingDifference: 0, monthDifference: 0, status: 'agrees' })
  })

  it('shows an earlier month as differing when its entries do not explain the statement', () => {
    // The statement says 5,700 on 1 Sep and 6,100 on 1 Oct (+400) but the entries for September add up to +500.
    const rows = buildMonthlyCheck(['2026-09-01', '2026-10-01'], lines.slice(-1), new Map([['2026-09-01', 5700], ['2026-10-01', 6100]]), { date: '2026-10-01', amount: 6100 })
    expect(rows[0]).toMatchObject({ openingDifference: 100, monthDifference: -100, status: 'differs' })
  })

  it('does not count entries before the opening balance date in the months after it', () => {
    // 1 Oct opening of 6,100; the September entry (+500) is older than the start, so 1 Nov is 6,100 plus October only.
    const rows = buildMonthlyCheck(['2026-10-01', '2026-11-01'], [...lines.slice(-1), { date: '2026-10-10', debit: 100, credit: 0 }], new Map(), { date: '2026-10-01', amount: 6100 })
    expect(rows.map((r) => r.calculatedOpening)).toEqual([6100, 6200])
  })

  it('takes a mid-month opening balance as the balance at the start of that day', () => {
    const l = [{ date: '2026-08-10', debit: 200, credit: 0 }]
    const rows = buildMonthlyCheck(['2026-08-01', '2026-09-01'], l, new Map(), { date: '2026-08-15', amount: 3000 })
    expect(rows.map((r) => r.calculatedOpening)).toEqual([2800, 3000])
  })

  it('adds up what has been entered when no opening balance is set', () => {
    const rows = buildMonthlyCheck(['2026-09-01', '2026-10-01'], lines, new Map(), null)
    expect(rows.map((r) => r.calculatedOpening)).toEqual([600, 1100])
  })
})
