import { describe, expect, it } from 'vitest'
import { inRange, projectSpend, sumOf, totalsBy, vendorPaidTotals } from './periodActivity'

describe('period activity', () => {
  it('knows what is inside a range, including open ends and the edges', () => {
    const r = { from: '2026-10-01', to: '2026-10-31' }
    expect(inRange('2026-10-01', r)).toBe(true)
    expect(inRange('2026-10-31', r)).toBe(true)
    expect(inRange('2026-09-30', r)).toBe(false)
    expect(inRange('2026-11-01', r)).toBe(false)
    expect(inRange('2026-01-01', { from: null, to: null })).toBe(true)
    expect(inRange('2026-01-01', null)).toBe(true)
    expect(inRange('2026-12-01', { from: '2026-10-01' })).toBe(true)
    expect(inRange('', r)).toBe(false)
  })

  it('totals by label, biggest first, to the paisa', () => {
    const rows = [
      { p: 'Villa', a: 100.1 },
      { p: 'Park', a: 500 },
      { p: 'Villa', a: 200.2 },
    ]
    expect(totalsBy(rows, (r) => r.p, (r) => r.a)).toEqual([
      { key: 'Park', count: 1, amount: 500 },
      { key: 'Villa', count: 2, amount: 300.3 },
    ])
    expect(sumOf(rows, (r) => r.a)).toBe(800.3)
  })

  it('counts vendor payments and advances, but not payments made from an advance', () => {
    const payments = [
      { amount: 1000, date: '2026-10-05', payment_mode: 'Bank' },
      { amount: 400, date: '2026-10-06', payment_mode: 'Reimbursement' },
      { amount: 6000, date: '2026-10-10', payment_mode: 'Advance' },
      { amount: 999, date: '2026-09-01', payment_mode: 'Bank' },
    ]
    const advances = [
      { amount: 10000, date: '2026-10-01' },
      { amount: 50, date: '2026-08-01' },
    ]
    expect(vendorPaidTotals(payments, advances, { from: '2026-10-01', to: '2026-10-31' })).toEqual({ bills: 1400, advances: 10000, total: 11400 })
  })

  it('works out what a project cost in the period, from expenses and vendor bills', () => {
    const expenses = [
      { project_id: 'p1', amount: 1000, date: '2026-10-05' },
      { project_id: 'p1', amount: 400, date: '2026-09-20' },
      { project_id: 'p2', amount: 999, date: '2026-10-06' },
    ]
    const bills = [
      { project_id: 'p1', date: '2026-10-10', amount: 2000, gst_pct: 18, other_cost: 100 },
      { project_id: 'p1', date: '2026-08-10', amount: 500, gst_pct: 0, other_cost: null },
      { project_id: 'p1', date: null, amount: 700, gst_pct: 0 },
    ]
    const oct = { from: '2026-10-01', to: '2026-10-31' }
    expect(projectSpend('p1', expenses, bills, oct)).toEqual({ expenses: 1000, bills: 2460, total: 3460 })
    // all time
    expect(projectSpend('p1', expenses, bills, null)).toEqual({ expenses: 1400, bills: 2960, total: 4360 })
    expect(projectSpend('nope', expenses, bills, oct).total).toBe(0)
  })
})
