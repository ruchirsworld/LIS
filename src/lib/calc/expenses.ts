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
