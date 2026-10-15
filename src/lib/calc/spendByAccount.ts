// How an amount spent was paid: from a bank account, in cash, from a supervisor's site float,
// or out of someone's own pocket (a reimbursable entry, which reaches a bank only when they are repaid).

export interface SpendRow {
  amount: number
  reimbursable: boolean
  paid_from_imprest: boolean
  bank_account_id: string | null
}

export interface BankName {
  id: string
  name: string
}

export interface SpendLine {
  key: string
  label: string
  amount: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** The first four, in this order, are always listed (even at nil); other banks, imprest and unknown banks only when used. */
const MAIN = ['Kotak', 'Cash', 'CBI', 'Reimbursement']

/** Splits what was spent by the account it was paid from. The lines always add up to the total of `rows`. */
export function spendByAccount(rows: SpendRow[], banks: BankName[]): { lines: SpendLine[]; total: number } {
  const totals = new Map<string, number>()
  const add = (label: string, amount: number) => totals.set(label, (totals.get(label) ?? 0) + amount)
  const nameOfBank = (id: string) => banks.find((b) => b.id === id)?.name ?? 'Other bank'

  for (const r of rows) {
    const amount = Number(r.amount || 0)
    if (r.reimbursable) add('Reimbursement', amount)
    else if (r.paid_from_imprest) add('Imprest', amount)
    else if (r.bank_account_id) add(nameOfBank(r.bank_account_id), amount)
    else add('Cash', amount)
  }

  const labels = [...MAIN, ...[...totals.keys()].filter((l) => !MAIN.includes(l)).sort()]
  const lines = labels
    .filter((l) => MAIN.includes(l) || (totals.get(l) ?? 0) !== 0)
    .map((label) => ({ key: label.toLowerCase().replace(/\s+/g, '-'), label, amount: round2(totals.get(label) ?? 0) }))
  return { lines, total: round2(rows.reduce((s, r) => s + Number(r.amount || 0), 0)) }
}
