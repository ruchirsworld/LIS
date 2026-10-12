import { describe, expect, it } from 'vitest'
import { billDue, billDueRaw, billGstAmt, billPayable, billTdsAmt, billTotal } from './vendorBills'

describe('vendor bills', () => {
  const bill = { amount: 50000, gst_pct: 18, other_cost: 1000, tds_pct: 2 }

  it('adds GST and other charges to the bill value', () => {
    expect(billGstAmt(bill)).toBe(9000)
    expect(billTotal(bill)).toBe(60000)
  })

  it('withholds TDS on the value plus other charges, before GST', () => {
    expect(billTdsAmt(bill)).toBe(1020)
    expect(billPayable(bill)).toBe(58980)
  })

  it('reports what is still owed, and a credit when overpaid', () => {
    expect(billDue(bill, [{ amount: 8980 }])).toBe(50000)
    expect(billDueRaw(bill, [{ amount: 60000 }])).toBe(-1020)
    expect(billDue(bill, [{ amount: 60000 }])).toBe(0)
  })
})
