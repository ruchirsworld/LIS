// Ported 1:1 from LIS_v1.0.html (billGstAmt/billTotal/billPaid/billDue).

export interface VendorBillRow {
  amount: number
  gst_pct: number | null
  other_cost?: number | null
}

export interface VendorBillPaymentRow {
  amount: number
}

export function billGstAmt(bill: VendorBillRow): number {
  return Number(bill.amount || 0) * Number(bill.gst_pct || 0) / 100
}

// amount and other_cost are tracked separately — other_cost feeds a
// distinct KPI in Projects rather than being blended into the bill value —
// but both still count toward what's actually owed to the vendor, so the
// payable total sums them.
export function billTotal(bill: VendorBillRow): number {
  return Number(bill.amount || 0) + billGstAmt(bill) + Number(bill.other_cost || 0)
}

export function billPaid(payments: VendorBillPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function billDue(bill: VendorBillRow, payments: VendorBillPaymentRow[]): number {
  return Math.max(0, billTotal(bill) - billPaid(payments))
}
