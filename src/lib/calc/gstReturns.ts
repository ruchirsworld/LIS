// Working papers for the monthly GST returns: GSTR-1 (outward supplies),
// GSTR-3B (summary and tax payable) and matching purchases against GSTR-2B.
// Pure functions over plain rows, so the screen only has to fetch and display.

import { cleanGstin, isValidGstin, stateCodeOfGstin } from '../gst'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface GstSplit {
  cgst: number
  sgst: number
  igst: number
  /** Tax that could not be split because a GSTIN is missing. */
  unsplit: number
}

/** CGST + SGST when both parties are in the same state, IGST otherwise. */
export function splitGst(gst: number, companyState: string, partyGstin: string | null | undefined): GstSplit {
  if (!gst) return { cgst: 0, sgst: 0, igst: 0, unsplit: 0 }
  const partyState = stateCodeOfGstin(partyGstin)
  if (!companyState || !partyState) return { cgst: 0, sgst: 0, igst: 0, unsplit: gst }
  if (companyState === partyState) {
    const cgst = round2(gst / 2)
    return { cgst, sgst: round2(gst - cgst), igst: 0, unsplit: 0 }
  }
  return { cgst: 0, sgst: 0, igst: gst, unsplit: 0 }
}

// ── GSTR-1 ───────────────────────────────────────────────────────────────────

export interface OutwardRow {
  kind: 'invoice' | 'credit' | 'debit'
  number: string
  date: string
  /** The invoice a credit / debit note is against. */
  againstNumber?: string
  gstin: string
  name: string
  /** Signed: credit notes are negative. */
  taxable: number
  gst: number
  rate: number
  hsn: string
  description: string
}

export interface Gstr1Line extends OutwardRow, GstSplit {
  /** Taxable value plus all tax. */
  value: number
}

export interface HsnLine extends GstSplit {
  hsn: string
  description: string
  taxable: number
  value: number
}

export function buildGstr1(rows: OutwardRow[], companyState: string) {
  const lines: Gstr1Line[] = rows.map((r) => {
    const s = splitGst(r.gst, companyState, r.gstin)
    return { ...r, ...s, value: round2(r.taxable + r.gst) }
  })
  const registered = (l: Gstr1Line) => isValidGstin(l.gstin)
  const b2b = lines.filter((l) => l.kind === 'invoice' && registered(l))
  const b2c = lines.filter((l) => l.kind === 'invoice' && !registered(l))
  const cdn = lines.filter((l) => l.kind !== 'invoice')

  const byHsn = new Map<string, HsnLine>()
  for (const l of lines) {
    const key = l.hsn.trim() || 'Not set'
    const cur = byHsn.get(key) ?? { hsn: key, description: l.description, taxable: 0, value: 0, cgst: 0, sgst: 0, igst: 0, unsplit: 0 }
    cur.taxable = round2(cur.taxable + l.taxable)
    cur.value = round2(cur.value + l.value)
    cur.cgst = round2(cur.cgst + l.cgst)
    cur.sgst = round2(cur.sgst + l.sgst)
    cur.igst = round2(cur.igst + l.igst)
    cur.unsplit = round2(cur.unsplit + l.unsplit)
    if (!cur.description && l.description) cur.description = l.description
    byHsn.set(key, cur)
  }
  const sum = (pick: (l: Gstr1Line) => number) => round2(lines.reduce((s, l) => s + pick(l), 0))
  return {
    b2b,
    b2c,
    cdn,
    hsn: [...byHsn.values()].sort((a, b) => a.hsn.localeCompare(b.hsn)),
    totals: { taxable: sum((l) => l.taxable), cgst: sum((l) => l.cgst), sgst: sum((l) => l.sgst), igst: sum((l) => l.igst), unsplit: sum((l) => l.unsplit) },
  }
}

// ── GSTR-3B ──────────────────────────────────────────────────────────────────

export interface InwardRow {
  /** The supplier's own invoice number (what GSTR-2B shows). */
  number: string
  date: string
  gstin: string
  name: string
  taxable: number
  gst: number
}

export interface Gstr3b {
  outward: { taxable: number } & GstSplit
  itc: GstSplit
  /** Output tax less input credit, head by head (negative means credit left over). */
  payable: { cgst: number; sgst: number; igst: number; unsplit: number }
}

export function buildGstr3b(outward: OutwardRow[], inward: InwardRow[], companyState: string): Gstr3b {
  const out = buildGstr1(outward, companyState).totals
  const itc: GstSplit = { cgst: 0, sgst: 0, igst: 0, unsplit: 0 }
  for (const r of inward) {
    const s = splitGst(r.gst, companyState, r.gstin)
    itc.cgst = round2(itc.cgst + s.cgst)
    itc.sgst = round2(itc.sgst + s.sgst)
    itc.igst = round2(itc.igst + s.igst)
    itc.unsplit = round2(itc.unsplit + s.unsplit)
  }
  return {
    outward: { taxable: out.taxable, cgst: out.cgst, sgst: out.sgst, igst: out.igst, unsplit: out.unsplit },
    itc,
    payable: {
      cgst: round2(out.cgst - itc.cgst),
      sgst: round2(out.sgst - itc.sgst),
      igst: round2(out.igst - itc.igst),
      unsplit: round2(out.unsplit - itc.unsplit),
    },
  }
}

// ── Matching purchases against GSTR-2B ───────────────────────────────────────

export interface PortalRow {
  gstin: string
  number: string
  date?: string
  taxable: number
  /** Total tax (IGST + CGST + SGST) on the invoice. */
  tax: number
}

export interface Match {
  books: InwardRow
  portal: PortalRow
  taxDifference: number
}

export interface Reconciliation {
  matched: Match[]
  /** Same supplier and invoice number, but the tax differs. */
  mismatched: Match[]
  /** In your books, not in GSTR-2B: input credit you cannot claim yet. */
  missingIn2b: InwardRow[]
  /** In GSTR-2B, not in your books: probably an unrecorded bill. */
  missingInBooks: PortalRow[]
}

/** Letters and digits only, with leading zeros dropped from each part, so "RA/26-27/001" matches "ra 26 27 1". */
export function normaliseInvoiceNo(s: string): string {
  return s
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((part) => part.replace(/^0+(?=\d)/, ''))
    .join('')
}

const keyOf = (gstin: string, number: string) => `${cleanGstin(gstin)}|${normaliseInvoiceNo(number)}`

export function reconcile2b(books: InwardRow[], portal: PortalRow[], tolerance = 1): Reconciliation {
  const portalByKey = new Map<string, PortalRow>()
  for (const p of portal) portalByKey.set(keyOf(p.gstin, p.number), p)
  const used = new Set<string>()
  const result: Reconciliation = { matched: [], mismatched: [], missingIn2b: [], missingInBooks: [] }

  for (const b of books) {
    if (!b.gst) continue // No tax, nothing to claim.
    const key = keyOf(b.gstin, b.number)
    const p = portalByKey.get(key)
    if (!p || !b.number) {
      result.missingIn2b.push(b)
      continue
    }
    used.add(key)
    const taxDifference = round2(b.gst - p.tax)
    ;(Math.abs(taxDifference) <= tolerance ? result.matched : result.mismatched).push({ books: b, portal: p, taxDifference })
  }
  for (const [key, p] of portalByKey) if (!used.has(key)) result.missingInBooks.push(p)
  return result
}
