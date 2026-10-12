import type { PortalRow } from '../calc/gstReturns'

// Reads the invoice list out of a GSTR-2B file downloaded from the GST portal
// (its B2B sheet), or any sheet or CSV with the same kind of columns: supplier
// GSTIN, invoice number, invoice date, taxable value and the tax columns. The
// portal's headers sit on two rows ("Integrated Tax" above "(₹)"), so headers
// are matched by wording and the rows above the data are skipped.

const text = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function parseGstr2bRows(rows: unknown[][]): PortalRow[] {
  const headerAt = rows.findIndex((r) => r.some((c) => /gstin/i.test(text(c))) && r.some((c) => /invoice\s*(number|no)/i.test(text(c))))
  if (headerAt === -1) throw new Error('This file has no column for supplier GSTIN and invoice number. Use the B2B sheet of the GSTR-2B file from the GST portal.')

  // A header cell may be split over this row and the one above it.
  const above = rows[headerAt - 1] ?? []
  const label = (i: number) => `${text(above[i])} ${text(rows[headerAt][i])}`
  const width = Math.max(...rows.slice(Math.max(0, headerAt - 1), headerAt + 1).map((r) => r.length))
  const find = (re: RegExp) => Array.from({ length: width }, (_, i) => i).filter((i) => re.test(label(i)))

  const gstinCol = find(/gstin/i)[0]
  const numberCol = find(/invoice\s*(number|no)/i)[0]
  const dateCol = find(/invoice\s*date/i)[0]
  const taxableCol = find(/taxable/i)[0]
  const taxCols = find(/integrated|central\s*tax|state\/?ut\s*tax|igst|cgst|sgst/i)
  if (gstinCol === undefined || numberCol === undefined || taxableCol === undefined) {
    throw new Error('Could not find the taxable value column in this file.')
  }

  const out: PortalRow[] = []
  for (const r of rows.slice(headerAt + 1)) {
    const gstin = text(r[gstinCol])
    const number = text(r[numberCol])
    if (!gstin || !number || /^total/i.test(gstin)) continue
    out.push({
      gstin,
      number,
      date: dateCol === undefined ? undefined : text(r[dateCol]),
      taxable: num(r[taxableCol]),
      tax: taxCols.reduce((s, c) => s + num(r[c]), 0),
    })
  }
  return out
}
