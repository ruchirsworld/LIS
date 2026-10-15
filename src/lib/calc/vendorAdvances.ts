// Advances paid to a vendor before a bill exists. When the bill is entered the database adjusts the
// oldest advance against it as a payment with mode 'Advance' (see 20261028000000_vendor_advances.sql);
// these helpers read that back.

export interface AdvanceRow {
  id: string
  amount: number
}

export interface AdvanceAdjustmentRow {
  advance_id?: string | null
  amount: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** How much of an advance has been set against bills. */
export function advanceUsed(advance: AdvanceRow, payments: AdvanceAdjustmentRow[]): number {
  return round2(payments.filter((p) => p.advance_id === advance.id).reduce((s, p) => s + Number(p.amount || 0), 0))
}

/** What is left of an advance: money paid to the vendor that no bill has used yet. */
export function advanceBalance(advance: AdvanceRow, payments: AdvanceAdjustmentRow[]): number {
  return Math.max(0, round2(Number(advance.amount || 0) - advanceUsed(advance, payments)))
}
