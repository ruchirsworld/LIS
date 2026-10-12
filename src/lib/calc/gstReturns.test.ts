import { describe, expect, it } from 'vitest'
import { buildGstr1, buildGstr3b, normaliseInvoiceNo, reconcile2b, splitGst, type InwardRow, type OutwardRow } from './gstReturns'

const DELHI = '07'
const DELHI_GSTIN = '07AAJFL1554B1ZN'
const HARYANA_GSTIN = '06AAJFL1554B1ZO'

describe('splitting GST by place of supply', () => {
  it('uses CGST and SGST inside the state', () => {
    expect(splitGst(18000, DELHI, DELHI_GSTIN)).toEqual({ cgst: 9000, sgst: 9000, igst: 0, unsplit: 0 })
  })
  it('puts odd paise on SGST so the halves add up', () => {
    const s = splitGst(100.01, DELHI, DELHI_GSTIN)
    expect(s.cgst + s.sgst).toBeCloseTo(100.01, 2)
  })
  it('uses IGST between states', () => {
    expect(splitGst(18000, DELHI, HARYANA_GSTIN)).toEqual({ cgst: 0, sgst: 0, igst: 18000, unsplit: 0 })
  })
  it('leaves tax unsplit when a GSTIN is missing', () => {
    expect(splitGst(500, DELHI, '').unsplit).toBe(500)
    expect(splitGst(500, '', DELHI_GSTIN).unsplit).toBe(500)
  })
})

const out = (over: Partial<OutwardRow>): OutwardRow => ({
  kind: 'invoice',
  number: 'INV/1',
  date: '2026-10-05',
  gstin: DELHI_GSTIN,
  name: 'Client',
  taxable: 100000,
  gst: 18000,
  rate: 18,
  hsn: '9954',
  description: 'Construction',
  ...over,
})

describe('GSTR-1 working', () => {
  it('sorts supplies into B2B, B2C and credit/debit notes', () => {
    const g = buildGstr1(
      [out({}), out({ number: 'INV/2', gstin: '' }), out({ kind: 'credit', number: 'CN/1', taxable: -10000, gst: -1800 })],
      DELHI
    )
    expect(g.b2b).toHaveLength(1)
    expect(g.b2c).toHaveLength(1)
    expect(g.cdn).toHaveLength(1)
    expect(g.totals.taxable).toBe(190000)
  })

  it('summarises by HSN/SAC', () => {
    const g = buildGstr1([out({}), out({ number: 'INV/2', taxable: 50000, gst: 9000 }), out({ number: 'INV/3', hsn: '' })], DELHI)
    expect(g.hsn.find((h) => h.hsn === '9954')?.taxable).toBe(150000)
    expect(g.hsn.find((h) => h.hsn === 'Not set')).toBeDefined()
  })
})

describe('GSTR-3B working', () => {
  it('sets input credit against output tax, head by head', () => {
    const inward: InwardRow[] = [{ number: 'V/1', date: '2026-10-02', gstin: DELHI_GSTIN, name: 'Vendor', taxable: 20000, gst: 3600 }]
    const r = buildGstr3b([out({})], inward, DELHI)
    expect(r.outward.taxable).toBe(100000)
    expect(r.itc.cgst).toBe(1800)
    expect(r.payable.cgst).toBe(7200)
    expect(r.payable.sgst).toBe(7200)
    expect(r.payable.igst).toBe(0)
  })
})

describe('matching purchases to GSTR-2B', () => {
  const book = (number: string, gst = 1800, gstin = DELHI_GSTIN): InwardRow => ({ number, date: '2026-10-01', gstin, name: 'V', taxable: 10000, gst })

  it('ignores punctuation, case and leading zeros in invoice numbers', () => {
    expect(normaliseInvoiceNo('ra/26-27/001')).toBe(normaliseInvoiceNo('RA 26 27 1'))
  })

  it('finds matches, tax differences and the missing on each side', () => {
    const r = reconcile2b(
      [book('A/1'), book('A/2', 1800), book('A/3')],
      [
        { gstin: DELHI_GSTIN, number: 'a-1', taxable: 10000, tax: 1800 },
        { gstin: DELHI_GSTIN, number: 'A/2', taxable: 10000, tax: 1500 },
        { gstin: DELHI_GSTIN, number: 'A/9', taxable: 500, tax: 90 },
      ]
    )
    expect(r.matched).toHaveLength(1)
    expect(r.mismatched[0].taxDifference).toBe(300)
    expect(r.missingIn2b.map((b) => b.number)).toEqual(['A/3'])
    expect(r.missingInBooks.map((p) => p.number)).toEqual(['A/9'])
  })

  it('does not chase bills with no GST', () => {
    expect(reconcile2b([book('B/1', 0)], []).missingIn2b).toHaveLength(0)
  })
})
