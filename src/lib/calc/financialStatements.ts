// Profit & Loss and Balance Sheet, built from account totals in the ledger.
// Both are laid out in the vertical format used for Indian accounts: income
// and expenses leading to profit; partners' funds and liabilities against
// assets. Nothing here is stored — each statement is worked out from the
// ledger on request, so it always agrees with the books.

export interface GlBalance {
  code: string
  name: string
  account_type: string
  normal_balance: string
  sort_order: number
  total_debit: number
  total_credit: number
}

export type LineKind = 'heading' | 'line' | 'subtotal' | 'total'

export interface StatementLine {
  label: string
  cur: number
  prev: number
  kind: LineKind
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Debit minus credit for the listed account codes (assets, expenses). */
function debitSide(rows: GlBalance[], codes: string[]): number {
  return round2(rows.filter((r) => codes.includes(r.code)).reduce((s, r) => s + Number(r.total_debit) - Number(r.total_credit), 0))
}
/** Credit minus debit for the listed account codes (liabilities, equity, income). */
function creditSide(rows: GlBalance[], codes: string[]): number {
  return -debitSide(rows, codes)
}

const byType = (rows: GlBalance[], type: string) => rows.filter((r) => r.account_type === type)

/** Net profit of a set of balances: income less expenses. */
export function netProfitOf(rows: GlBalance[]): number {
  const income = byType(rows, 'income').reduce((s, r) => s + Number(r.total_credit) - Number(r.total_debit), 0)
  const expense = byType(rows, 'expense').reduce((s, r) => s + Number(r.total_debit) - Number(r.total_credit), 0)
  return round2(income - expense)
}

const line = (label: string, cur: number, prev: number, kind: LineKind = 'line'): StatementLine => ({ label, cur: round2(cur), prev: round2(prev), kind })
const nonZero = (l: StatementLine) => Math.abs(l.cur) > 0.004 || Math.abs(l.prev) > 0.004

export function buildProfitAndLoss(cur: GlBalance[], prev: GlBalance[]): { lines: StatementLine[]; netProfit: { cur: number; prev: number } } {
  const lines: StatementLine[] = []
  const incomeOther = (rows: GlBalance[]) =>
    byType(rows, 'income')
      .filter((r) => r.code !== '4010')
      .reduce((s, r) => s + Number(r.total_credit) - Number(r.total_debit), 0)

  lines.push(line('Income', 0, 0, 'heading'))
  lines.push(line('Revenue from operations', creditSide(cur, ['4010']), creditSide(prev, ['4010'])))
  const other = line('Other income', incomeOther(cur), incomeOther(prev))
  if (nonZero(other)) lines.push(other)
  const totalIncome = (rows: GlBalance[]) => byType(rows, 'income').reduce((s, r) => s + Number(r.total_credit) - Number(r.total_debit), 0)
  lines.push(line('Total income', totalIncome(cur), totalIncome(prev), 'subtotal'))

  lines.push(line('Expenses', 0, 0, 'heading'))
  const expenseCodes = [...new Set([...byType(cur, 'expense'), ...byType(prev, 'expense')].map((r) => r.code))].sort()
  const nameOf = (code: string) => [...cur, ...prev].find((r) => r.code === code)?.name ?? code
  for (const code of expenseCodes) {
    const l = line(nameOf(code), debitSide(cur, [code]), debitSide(prev, [code]))
    if (nonZero(l)) lines.push(l)
  }
  const totalExpense = (rows: GlBalance[]) => byType(rows, 'expense').reduce((s, r) => s + Number(r.total_debit) - Number(r.total_credit), 0)
  lines.push(line('Total expenses', totalExpense(cur), totalExpense(prev), 'subtotal'))

  const netProfit = { cur: netProfitOf(cur), prev: netProfitOf(prev) }
  lines.push(line('Profit before tax', netProfit.cur, netProfit.prev, 'subtotal'))
  lines.push(line('Net profit for the year', netProfit.cur, netProfit.prev, 'total'))
  return { lines, netProfit }
}

const CAPITAL = ['3010']
const BORROWINGS = ['2040']
const PAYABLES = ['2010']
const ADVANCES = ['2060']
const REIMBURSE = ['2020']
const SALARIES = ['2050']
const GST_PAYABLE = ['2030', '2031', '2032', '2033']
const TDS_PAYABLE = ['2070']
const CASH = ['1010']
const BANK = ['1020']
const RECEIVABLES = ['1030']
const RETENTION = ['1035']
const TDS_RECEIVABLE = ['1040']
const GST_INPUT = ['1050', '1051', '1052', '1053']
const IMPREST = ['1060']
const STAFF_ADVANCE = ['1070']
const SUPPLIER_ADVANCE = ['1075']

const MAPPED_ASSETS = [...CASH, ...BANK, ...RECEIVABLES, ...RETENTION, ...TDS_RECEIVABLE, ...GST_INPUT, ...IMPREST, ...STAFF_ADVANCE, ...SUPPLIER_ADVANCE]
const MAPPED_LIABILITIES = [...BORROWINGS, ...PAYABLES, ...ADVANCES, ...REIMBURSE, ...SALARIES, ...GST_PAYABLE, ...TDS_PAYABLE]

/**
 * `cur` / `prev` are the ledger totals from the start of the books up to the
 * balance-sheet date and the previous year-end. `profitForYear` is the P&L of
 * the year just ended (and of the year before it) so the equity can show
 * profit brought forward and profit for the year separately.
 */
export function buildBalanceSheet(
  cur: GlBalance[],
  prev: GlBalance[],
  profitForYear: { cur: number; prev: number }
): { lines: StatementLine[]; totals: { assets: { cur: number; prev: number }; funds: { cur: number; prev: number } } } {
  const lines: StatementLine[] = []
  const both = (fn: (rows: GlBalance[]) => number) => [fn(cur), fn(prev)] as const
  const add = (label: string, [c, p]: readonly [number, number], kind: LineKind = 'line', keepZero = false) => {
    const l = line(label, c, p, kind)
    if (kind !== 'line' || keepZero || nonZero(l)) lines.push(l)
  }

  // ── Equity and liabilities ───────────────────────────────────────────────
  lines.push(line('EQUITY AND LIABILITIES', 0, 0, 'heading'))
  lines.push(line("Partners' funds", 0, 0, 'heading'))
  const capital = both((r) => creditSide(r, CAPITAL))
  const cumulativeProfit = both(netProfitOf)
  const broughtForward: [number, number] = [cumulativeProfit[0] - profitForYear.cur, cumulativeProfit[1] - profitForYear.prev]
  add("Partners' capital", capital, 'line', true)
  add('Profit brought forward', broughtForward, 'line', true)
  add('Profit for the year', [profitForYear.cur, profitForYear.prev], 'line', true)
  const otherEquity = both((r) =>
    byType(r, 'equity')
      .filter((x) => !CAPITAL.includes(x.code))
      .reduce((s, x) => s + Number(x.total_credit) - Number(x.total_debit), 0)
  )
  add('Other reserves', otherEquity)
  const funds: [number, number] = [capital[0] + broughtForward[0] + profitForYear.cur + otherEquity[0], capital[1] + broughtForward[1] + profitForYear.prev + otherEquity[1]]
  add("Total partners' funds", funds, 'subtotal')

  const borrowings = both((r) => creditSide(r, BORROWINGS))
  if (Math.abs(borrowings[0]) > 0.004 || Math.abs(borrowings[1]) > 0.004) {
    lines.push(line('Borrowings', 0, 0, 'heading'))
    add('Loans payable', borrowings)
    add('Total borrowings', borrowings, 'subtotal')
  }

  lines.push(line('Current liabilities', 0, 0, 'heading'))
  const currentLiab: [number, number][] = []
  const addLiab = (label: string, codes: string[]) => {
    const v = both((r) => creditSide(r, codes))
    currentLiab.push([v[0], v[1]])
    add(label, v)
  }
  addLiab('Trade payables', PAYABLES)
  addLiab('Advances from customers', ADVANCES)
  addLiab('Employee reimbursements payable', REIMBURSE)
  addLiab('Salaries payable', SALARIES)
  addLiab('GST payable', GST_PAYABLE)
  addLiab('TDS payable', TDS_PAYABLE)
  const otherLiab = both((r) =>
    byType(r, 'liability')
      .filter((x) => !MAPPED_LIABILITIES.includes(x.code))
      .reduce((s, x) => s + Number(x.total_credit) - Number(x.total_debit), 0)
  )
  currentLiab.push([otherLiab[0], otherLiab[1]])
  add('Other liabilities', otherLiab)
  const totalCurrentLiab: [number, number] = [currentLiab.reduce((s, v) => s + v[0], 0), currentLiab.reduce((s, v) => s + v[1], 0)]
  add('Total current liabilities', totalCurrentLiab, 'subtotal')

  const eqLiab: [number, number] = [funds[0] + borrowings[0] + totalCurrentLiab[0], funds[1] + borrowings[1] + totalCurrentLiab[1]]
  add('TOTAL EQUITY AND LIABILITIES', eqLiab, 'total')

  // ── Assets ───────────────────────────────────────────────────────────────
  lines.push(line('ASSETS', 0, 0, 'heading'))
  lines.push(line('Current assets', 0, 0, 'heading'))
  const assets: [number, number][] = []
  const addAsset = (label: string, codes: string[]) => {
    const v = both((r) => debitSide(r, codes))
    assets.push([v[0], v[1]])
    add(label, v)
  }
  addAsset('Cash in hand', CASH)
  addAsset('Balances with banks', BANK)
  addAsset('Trade receivables', RECEIVABLES)
  addAsset('Retention money receivable', RETENTION)
  addAsset('Tax deducted at source (receivable)', TDS_RECEIVABLE)
  addAsset('GST input credit', GST_INPUT)
  addAsset('Site imprest held by supervisors', IMPREST)
  addAsset('Advances to staff', STAFF_ADVANCE)
  addAsset('Advances to suppliers', SUPPLIER_ADVANCE)
  const otherAssets = both((r) =>
    byType(r, 'asset')
      .filter((x) => !MAPPED_ASSETS.includes(x.code))
      .reduce((s, x) => s + Number(x.total_debit) - Number(x.total_credit), 0)
  )
  assets.push([otherAssets[0], otherAssets[1]])
  add('Other assets', otherAssets)
  const totalAssets: [number, number] = [assets.reduce((s, v) => s + v[0], 0), assets.reduce((s, v) => s + v[1], 0)]
  add('Total current assets', totalAssets, 'subtotal')
  add('TOTAL ASSETS', totalAssets, 'total')

  return { lines, totals: { assets: { cur: round2(totalAssets[0]), prev: round2(totalAssets[1]) }, funds: { cur: round2(eqLiab[0]), prev: round2(eqLiab[1]) } } }
}

// ── Financial year helpers (April to March) ────────────────────────────────

export function fyStartYearOf(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number)
  return m >= 4 ? y : y - 1
}
export function fyLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`
}
export function fyRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}
