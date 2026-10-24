import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { monthSlip, shiftMonthStr, type SlipPayment, type SlipRun } from './salarySlip'

const staff = { daily_rate: 1000, start_date: '2026-08-01', end_date: null }
const run = (id: string, a: string, b: string, amount: number): SlipRun => ({ id, display_id: id, period_start: a, period_end: b, amount })
const pay = (id: string, date: string, amount: number): SlipPayment => ({ id, display_id: id, date, amount, advance_recovered: null, bank_account_id: null, notes: null })
const base = { staff, attendance: [], holidayDates: new Set<string>(), workedHolidayDates: [], runs: [] as SlipRun[], payments: [] as SlipPayment[] }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T10:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('shiftMonthStr', () => {
  it('moves across year ends', () => {
    expect(shiftMonthStr('2026-12', 1)).toBe('2027-01')
    expect(shiftMonthStr('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthSlip', () => {
  it('works the month out from the days: unpaid absence and half days come off the gross', () => {
    // September: 30 days. 5 absences (first 4 are the free leave, the 5th is unpaid), 2 half days, 1 holiday.
    const attendance = [
      ...['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'].map((date) => ({ date, day_type: 'absent' as const })),
      ...['2026-09-05', '2026-09-12'].map((date) => ({ date, day_type: 'half_day' as const })),
    ]
    const s = monthSlip({ ...base, attendance, holidayDates: new Set(['2026-09-15']), month: '2026-09' })
    expect(s.counts).toEqual({ total: 30, present: 22, paidLeave: 4, unpaidLeave: 1, halfDays: 2, holidays: 1 })
    expect(s.base).toBe(30000 - 1000 - 1000)
    expect(s.salary).toBe(28000)
    expect(s.days.filter((d) => d.type === 'unpaid_off').map((d) => d.date)).toEqual(['2026-09-30'])
  })

  it('counts the next month\'s payments against the month, and carries what is still due into the next slip', () => {
    // August (31 days) and September (30 days) at 1000 a day. Paid in September 31000 (August in full), in October 20000 (for September).
    const payments = [pay('p1', '2026-09-05', 31000), pay('p2', '2026-10-05', 20000)]
    const aug = monthSlip({ ...base, month: '2026-08', payments })
    expect(aug.salary).toBe(31000)
    expect(aug.paid.map((p) => p.id)).toEqual(['p1'])
    expect(aug.due).toBe(0)

    const sep = monthSlip({ ...base, month: '2026-09', payments })
    expect(sep.broughtForward).toBe(0)
    expect(sep.salary).toBe(30000)
    expect(sep.paid.map((p) => p.id)).toEqual(['p2'])
    expect(sep.paidTotal).toBe(20000)
    expect(sep.due).toBe(10000)

    // October's slip shows the 10000 still due from September.
    const oct = monthSlip({ ...base, month: '2026-10', payments })
    expect(oct.broughtForward).toBe(10000)
    expect(oct.paid).toEqual([])
    expect(oct.due).toBe(oct.broughtForward + oct.salary)
  })

  it('uses the payroll run amount when the run sits inside the month, and shows the extra as bonus/adjustment', () => {
    const runs = [run('WA-1', '2026-09-01', '2026-09-30', 31500)] // 30000 from days + 1500 bonus
    const s = monthSlip({ ...base, month: '2026-09', runs })
    expect(s.base).toBe(30000)
    expect(s.extras).toBe(1500)
    expect(s.salary).toBe(31500)
    expect(s.runs).toHaveLength(1)
  })

  it('mixes a part-month run with the days not yet run', () => {
    const runs = [run('WA-1', '2026-09-01', '2026-09-10', 10500)] // 10 days = 10000, plus 500
    const s = monthSlip({ ...base, month: '2026-09', runs })
    expect(s.extras).toBe(500)
    expect(s.salary).toBe(30500)
  })

  it('falls back to the days when one run covers several months', () => {
    const runs = [run('WA-1', '2026-08-01', '2026-09-30', 99999)]
    const s = monthSlip({ ...base, month: '2026-09', runs })
    expect(s.sharedRuns).toHaveLength(1)
    expect(s.runs).toHaveLength(0)
    expect(s.salary).toBe(30000)
  })

  it('starts counting from the joining date and stops at today', () => {
    const joined = monthSlip({ ...base, staff: { ...staff, start_date: '2026-09-20' }, month: '2026-09' })
    expect(joined.counts.total).toBe(11)
    const current = monthSlip({ ...base, month: '2026-10' })
    expect(current.counts.total).toBe(25)
  })
})
