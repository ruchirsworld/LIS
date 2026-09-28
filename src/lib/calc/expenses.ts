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
