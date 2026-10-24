import { computeAccrualDays, isoDatesBetween, type AccrualDay, type AccrualStaff, type AttendanceDay } from './payroll'

// The month-wise salary slip. Wages are paid a month in arrears: what is paid in October is the September salary. So a month's slip shows that
// month's salary, the payments made in the NEXT month against it, and what is still due. Anything still due carries into the next month's slip as
// "brought forward".

export interface SlipRun {
  id: string
  display_id: string | null
  period_start: string
  period_end: string
  amount: number
}

export interface SlipPayment {
  id: string
  display_id: string | null
  date: string
  amount: number
  advance_recovered: number | null
  bank_account_id: string | null
  notes: string | null
}

export interface MonthSlip {
  month: string
  monthStart: string
  monthEnd: string
  /** Every day of the month on the job (up to today), day by day. */
  days: AccrualDay[]
  counts: { total: number; present: number; paidLeave: number; unpaidLeave: number; halfDays: number; holidays: number }
  /** What the days alone come to: gross, less the unpaid days, less half the half days. */
  base: number
  /** Bonus, incentive, allowance or any edit to the payroll run(s) made in this month: the run amounts less what the days alone come to. */
  extras: number
  /** The month's salary: base plus extras. */
  salary: number
  /** The payroll runs that sit wholly inside this month. */
  runs: SlipRun[]
  /** Runs that cover this month together with other months: their amount can't be split, so the days alone are used for this month. */
  sharedRuns: SlipRun[]
  /** Still due from earlier months, after every payment made up to the end of this month (negative: paid ahead). */
  broughtForward: number
  /** Next month, when the payments for this month are made. */
  paidMonth: string
  paid: SlipPayment[]
  paidTotal: number
  /** Brought forward + this month's salary - the payments made next month. Carries into the next month's slip. */
  due: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function shiftMonthStr(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function lastDay(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function monthSlip(args: {
  staff: AccrualStaff
  month: string
  attendance: AttendanceDay[]
  holidayDates: Set<string>
  workedHolidayDates: string[]
  runs: SlipRun[]
  payments: SlipPayment[]
}): MonthSlip {
  const { staff, month, attendance, holidayDates, workedHolidayDates, runs, payments } = args

  // One month's salary and the pieces of it.
  function monthParts(ym: string) {
    const start = `${ym}-01`
    const end = lastDay(ym)
    const days = computeAccrualDays(staff, attendance, holidayDates, start, end, workedHolidayDates)
    const base = round2(days.reduce((t, d) => t + d.amount, 0))
    const overlapping = runs.filter((r) => r.period_start <= end && r.period_end >= start)
    const inside = overlapping.filter((r) => r.period_start >= start && r.period_end <= end)
    const shared = overlapping.filter((r) => !(r.period_start >= start && r.period_end <= end))
    const covered = new Set<string>()
    for (const r of inside) for (const d of isoDatesBetween(r.period_start, r.period_end)) covered.add(d)
    const computedCovered = days.filter((d) => covered.has(d.date)).reduce((t, d) => t + d.amount, 0)
    const runTotal = inside.reduce((t, r) => t + Number(r.amount || 0), 0)
    const extras = inside.length ? round2(runTotal - computedCovered) : 0
    return { start, end, days, base, inside, shared, extras, salary: round2(base + extras) }
  }

  const cur = monthParts(month)
  const paidMonth = shiftMonthStr(month, 1)
  const paidStart = `${paidMonth}-01`
  const paid = payments.filter((p) => p.date.startsWith(paidMonth)).sort((a, b) => a.date.localeCompare(b.date))
  const paidTotal = round2(paid.reduce((t, p) => t + Number(p.amount || 0), 0))

  // Earlier months' salaries, less every payment made up to the end of this month.
  let earlier = 0
  for (let ym = staff.start_date.slice(0, 7); ym < month; ym = shiftMonthStr(ym, 1)) earlier += monthParts(ym).salary
  const paidUpToEndOfMonth = payments.filter((p) => p.date < paidStart).reduce((t, p) => t + Number(p.amount || 0), 0)
  const broughtForward = round2(earlier - paidUpToEndOfMonth)

  const c = { total: 0, present: 0, paidLeave: 0, unpaidLeave: 0, halfDays: 0, holidays: 0 }
  for (const d of cur.days) {
    c.total++
    if (d.type === 'present') c.present++
    else if (d.type === 'paid_off') c.paidLeave++
    else if (d.type === 'unpaid_off') c.unpaidLeave++
    else if (d.type === 'half_day') c.halfDays++
    else if (d.type === 'holiday') c.holidays++
  }

  return {
    month,
    monthStart: cur.start,
    monthEnd: cur.end,
    days: cur.days,
    counts: c,
    base: cur.base,
    extras: cur.extras,
    salary: cur.salary,
    runs: cur.inside,
    sharedRuns: cur.shared,
    broughtForward,
    paidMonth,
    paid,
    paidTotal,
    due: round2(broughtForward + cur.salary - paidTotal),
  }
}
