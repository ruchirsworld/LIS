// Ported 1:1 from LIS_v1.0.html (billGstAmt/billTotal/billPaid/billDue).

export interface VendorBillRow {
  amount: number
  gst_pct: number | null
  other_cost?: number | null
  /** TDS the firm deducts from the vendor, as a % of the bill before GST. */
  tds_pct?: number | null
}

export interface VendorBillPaymentRow {
  amount: number
}

// Held to the paisa, as posted to the ledger.
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function billGstAmt(bill: VendorBillRow): number {
  return round2(Number(bill.amount || 0) * Number(bill.gst_pct || 0) / 100)
}

/** TDS withheld from the vendor — on the bill value plus other charges, before GST. */
export function billTdsAmt(bill: VendorBillRow): number {
  return round2((Number(bill.amount || 0) + Number(bill.other_cost || 0)) * Number(bill.tds_pct || 0) / 100)
}

// amount and other_cost are tracked separately — other_cost feeds a
// distinct KPI in Projects rather than being blended into the bill value —
// but both still count toward what's actually owed to the vendor, so the
// payable total sums them.
export function billTotal(bill: VendorBillRow): number {
  return Number(bill.amount || 0) + billGstAmt(bill) + Number(bill.other_cost || 0)
}

/** What the vendor is actually owed: the bill less the TDS the firm holds back for the government. */
export function billPayable(bill: VendorBillRow): number {
  return billTotal(bill) - billTdsAmt(bill)
}

export function billPaid(payments: VendorBillPaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

// Unclamped — negative means this bill is overpaid (a credit). Payments
// don't always land on the exact bill they were meant to settle, so a
// vendor's real due is the NET across all their bills, not the sum of each
// bill's due floored at zero (which would silently swallow an overpayment
// on one bill instead of letting it offset an underpayment on another).
export function billDueRaw(bill: VendorBillRow, payments: VendorBillPaymentRow[]): number {
  return billPayable(bill) - billPaid(payments)
}

export function billDue(bill: VendorBillRow, payments: VendorBillPaymentRow[]): number {
  return Math.max(0, billDueRaw(bill, payments))
}

/** The bill value (before GST) whose payable, after GST and TDS, comes to the amount paid. Used when only the
 * payment is known, as on a bank statement line. Searches the paise around the exact answer, because GST and
 * TDS are each rounded to the paisa; when no whole-paisa value hits it exactly, the nearest one is returned
 * and `exact` is false. */
export function billBaseFromPaid(paid: number, gstPct: number, tdsPct: number): { base: number; payable: number; exact: boolean } {
  const factor = 1 + gstPct / 100 - tdsPct / 100
  const approx = Math.round((paid / (factor > 0 ? factor : 1)) * 100)
  let best = { base: approx / 100, payable: 0, diff: Infinity }
  for (let c = approx - 6; c <= approx + 6; c++) {
    const base = c / 100
    const payable = round2(billPayable({ amount: base, gst_pct: gstPct, tds_pct: tdsPct }))
    const diff = Math.abs(Math.round((payable - paid) * 100))
    if (diff < best.diff) best = { base, payable, diff }
  }
  return { base: best.base, payable: best.payable, exact: best.diff === 0 }
}
