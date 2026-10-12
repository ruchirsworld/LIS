import { describe, expect, it } from 'vitest'
import { parseGstr2bRows } from './gstr2b'

describe('GSTR-2B file reading', () => {
  it('reads the portal layout with its two-row header', () => {
    const rows: unknown[][] = [
      ['Goods and Services Tax - GSTR-2B'],
      ['GSTIN of supplier', 'Trade/Legal name', 'Invoice number', 'Invoice type', 'Invoice Date', 'Invoice Value(₹)', 'Place of supply', 'Reverse Charge', 'Taxable Value (₹)', 'Integrated Tax(₹)', 'Central Tax(₹)', 'State/UT Tax(₹)'],
      ['07AAJFL1554B1ZN', 'Vendor A', 'A/1', 'Regular', '01-10-2026', '11,800.00', 'Delhi', 'No', '10,000.00', '0', '900', '900'],
      ['06AAJFL1554B1ZO', 'Vendor B', 'B/7', 'Regular', '02-10-2026', '5900', 'Haryana', 'No', '5000', '900', '0', '0'],
      ['Total', '', '', '', '', '', '', '', '', '', '', ''],
    ]
    const out = parseGstr2bRows(rows)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ gstin: '07AAJFL1554B1ZN', number: 'A/1', taxable: 10000, tax: 1800 })
    expect(out[1].tax).toBe(900)
  })

  it('explains what is wrong with a file that is not 2B', () => {
    expect(() => parseGstr2bRows([['Name', 'Amount'], ['x', 1]])).toThrow(/GSTIN and invoice number/)
  })
})
