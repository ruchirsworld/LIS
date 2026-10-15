import { describe, expect, it } from 'vitest'
import { billDue, billDueRaw, billGstAmt, billPayable, billTdsAmt, billTotal, billBaseFromPaid } from './vendorBills'

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

describe('billBaseFromPaid', () => {
  it('works back from a payment with GST', () => {
    expect(billBaseFromPaid(118000, 18, 0)).toEqual({ base: 100000, payable: 118000, exact: true })
  })

  it('works back from a payment with GST and TDS', () => {
    // 50,000 + 9,000 GST - 500 TDS = 58,500
    expect(billBaseFromPaid(58500, 18, 1)).toEqual({ base: 50000, payable: 58500, exact: true })
  })

  it('is the payment itself when there is no GST or TDS', () => {
    expect(billBaseFromPaid(4321.5, 0, 0)).toEqual({ base: 4321.5, payable: 4321.5, exact: true })
  })

  it('lands within a few paise when no whole-paisa bill hits the amount exactly', () => {
    const r = billBaseFromPaid(1000.01, 18, 1)
    expect(Math.abs(r.payable - 1000.01)).toBeLessThan(0.03)
  })
})
