// Ported 1:1 from LIS_v1.0.html (billGstAmt/billTotal/billPaid/billDue).

export interface VendorBillRow {
  amount: number
  gst_pct: number | null
}

export interface VendorBillPaymentRow {
  amount: number
}

export function billGstAmt(bill: VendorBillRow): number {
  return Number(bill.amount || 0) * Number(bill.gst_pct || 0) / 100
}

export function billTotal(bill: VendorBillRow): number {
  return Number(bill.amount || 0) + billGstAmt(bill)
}

export function billPaid(payments: VendorBillPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function billDue(bill: VendorBillRow, payments: VendorBillPaymentRow[]): number {
  return Math.max(0, billTotal(bill) - billPaid(payments))
}
