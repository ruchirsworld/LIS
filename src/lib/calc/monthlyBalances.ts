// Checking the entries against the bank statement, month by month.
//
// Two opening balances are compared for every month:
//   1. the one typed from the statement (what the bank says the account held on the 1st), and
//   2. the one the app calculates from the entries, worked from the account's opening balance (the books start): forward from
//      it (opening + entries since) for later months, and backward (opening - entries since that month began) for earlier ones.
// A difference between them means entries made before that month are missing or wrong. When the difference
// changes from one month to the next, the entries of that month are the ones to look at. Each month can be checked
// on its own, so months can be entered in any order (newest first is fine).

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** First day of the month a YYYY-MM-DD date falls in. */
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`

/** Every month start from the one holding `from` to the one holding `to`, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let y = +from.slice(0, 4)
  let m = +from.slice(5, 7)
  const endY = +to.slice(0, 4)
  const endM = +to.slice(5, 7)
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export const nextMonth = (month: string) => {
  const y = +month.slice(0, 4)
  const m = +month.slice(5, 7)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

export type MonthStatus = 'agrees' | 'differs' | 'waiting' | 'no-opening'

export interface MonthRow {
  month: string
  /** 1. The balance typed from the statement for the 1st of the month. */
  statementOpening: number | null
  /** 2. The balance the app works out from the entries, for the 1st of the month. */
  calculatedOpening: number
  /** Typed less calculated. Not nil means entries before this month are missing or wrong (or the opening balance is). */
  openingDifference: number | null
  moneyIn: number
  moneyOut: number
  /** How much this month's entries are off by: the change in the difference from this month to the next. */
  monthDifference: number | null
  status: MonthStatus
}

export interface AccountLine {
  date: string
  debit: number
  credit: number
}

/** The account's opening balance: what it held at the start of `date`. The starting point for every month's calculation. */
export interface BooksStart {
  date: string
  amount: number
}

/** One row per month for ONE account. `lines` are the real movements (not the opening balance entry); `balances` holds
 * the statement balances typed, by month start; `start` is the account's opening balance, or null when none is set. */
export function buildMonthlyCheck(months: string[], lines: AccountLine[], balances: Map<string, number>, start: BooksStart | null): MonthRow[] {
  const real = lines
  const net = (from: string | null, to: string) =>
    real.filter((l) => (from === null || l.date >= from) && l.date < to).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0)

  // What the entries say the balance was at the very start of a month (before that day's entries).
  // From the opening balance: forward for months after it, backward for months before it, so months can be checked
  // newest first. With no opening balance set, it is only what has been entered so far.
  const calculatedAt = (month: string) => {
    if (!start) return round2(net(null, month))
    return round2(month >= start.date ? start.amount + net(start.date, month) : start.amount - net(month, start.date))
  }

  const moved = new Map<string, { in: number; out: number }>()
  for (const l of real) {
    const k = monthStart(l.date)
    const cur = moved.get(k) ?? { in: 0, out: 0 }
    cur.in += Number(l.debit || 0)
    cur.out += Number(l.credit || 0)
    moved.set(k, cur)
  }

  const gapAt = (month: string) => (balances.has(month) ? round2((balances.get(month) as number) - calculatedAt(month)) : null)

  return months.map((month) => {
    const mv = moved.get(month) ?? { in: 0, out: 0 }
    const opening = balances.has(month) ? (balances.get(month) as number) : null
    const gap = gapAt(month)
    const nextGap = gapAt(nextMonth(month))
    const monthDifference = gap !== null && nextGap !== null ? round2(nextGap - gap) : null
    const status: MonthStatus = opening === null ? 'no-opening' : nextGap === null ? 'waiting' : Math.abs(monthDifference as number) < 0.005 ? 'agrees' : 'differs'
    return {
      month,
      statementOpening: opening,
      calculatedOpening: calculatedAt(month),
      openingDifference: gap,
      moneyIn: round2(mv.in),
      moneyOut: round2(mv.out),
      monthDifference,
      status,
    }
  })
}

/** Plain words for how a month's entries are off: positive means the bank holds more than the entries explain. */
export function differenceHint(difference: number): string {
  const amount = Math.abs(difference).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  return difference > 0
    ? `The bank has ₹${amount} more than the entries explain. A receipt may be missing, or a payment is entered too high.`
    : `The bank has ₹${amount} less than the entries explain. A payment may be missing, or a receipt is entered too high.`
}
