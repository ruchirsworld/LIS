// Mirrors billPaid/billDue in vendorBills.ts — a reimbursable expense can be
// paid back over one or more installments, same as a vendor bill.

export interface ExpenseReimbursementRow {
  amount: number
}

export function expenseReimbursed(reimbursements: ExpenseReimbursementRow[]): number {
  return reimbursements.reduce((s, r) => s + Number(r.amount || 0), 0)
}

export function expenseDue(amount: number, reimbursements: ExpenseReimbursementRow[]): number {
  return Math.max(0, Number(amount || 0) - expenseReimbursed(reimbursements))
}

// An amount the firm owes back to an employee — either an expense they
// paid out of pocket, or a vendor payment they made ("Reimbursement" mode).
export type ReimbursementSource = 'expense' | 'vendor_payment'

export interface OutstandingExpense {
  id: string
  due: number
  source?: ReimbursementSource
}

export interface SettlementAllocation {
  expenseId: string
  amount: number
  source: ReimbursementSource
}

// Applies a lump-sum settlement across a user's outstanding reimbursable
// expenses, oldest first — `outstanding` must already be sorted oldest to
// newest. Fully consumes each expense's due before moving to the next,
// partially settling the last one it touches if the amount doesn't divide
// evenly, and stops once the amount runs out.
export function allocateSettlement(amount: number, outstanding: OutstandingExpense[]): SettlementAllocation[] {
  const allocations: SettlementAllocation[] = []
  let remaining = Number(amount || 0)
  for (const exp of outstanding) {
    if (remaining <= 0) break
    const alloc = Math.min(remaining, Number(exp.due || 0))
    if (alloc <= 0) continue
    allocations.push({ expenseId: exp.id, amount: alloc, source: exp.source ?? 'expense' })
    remaining -= alloc
  }
  return allocations
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** A settlement chosen entry by entry: the amount given to each entry, as typed. Entries left blank get nothing. */
export type ChosenAmounts = Record<string, string>

/** What is wrong with a hand-picked settlement, in words, or null when it is fine: each amount within what is
 * due on that entry, and together exactly the amount paid. */
export function chosenSettlementProblem(amount: number, chosen: ChosenAmounts, outstanding: OutstandingExpense[]): string | null {
  let total = 0
  for (const exp of outstanding) {
    const given = round2(Number(String(chosen[exp.id] ?? '').replace(/,/g, '')) || 0)
    if (given < 0) return 'An amount cannot be negative.'
    if (given > round2(exp.due) + 0.004) return `One entry was given ${given}, which is more than the ${round2(exp.due)} still due on it.`
    total += given
  }
  total = round2(total)
  const paid = round2(amount)
  if (total === 0) return 'Give the payment to at least one entry.'
  if (Math.abs(total - paid) > 0.004) {
    return total < paid ? `${round2(paid - total)} of the ${paid} is not given to any entry yet.` : `The entries add up to ${total}, which is ${round2(total - paid)} more than the ${paid} paid.`
  }
  return null
}

/** The settlement rows for a hand-picked split, in the order of `outstanding`. */
export function chosenToAllocations(chosen: ChosenAmounts, outstanding: OutstandingExpense[]): SettlementAllocation[] {
  const rows: SettlementAllocation[] = []
  for (const exp of outstanding) {
    const given = round2(Number(String(chosen[exp.id] ?? '').replace(/,/g, '')) || 0)
    if (given > 0) rows.push({ expenseId: exp.id, amount: given, source: exp.source ?? 'expense' })
  }
  return rows
}

/** The oldest-first split as typed amounts, to start a hand-picked one from. */
export function oldestFirstChoices(amount: number, outstanding: OutstandingExpense[]): ChosenAmounts {
  const chosen: ChosenAmounts = {}
  for (const a of allocateSettlement(amount, outstanding)) chosen[a.expenseId] = String(round2(a.amount))
  return chosen
}
