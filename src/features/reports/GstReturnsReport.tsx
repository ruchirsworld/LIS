import { useMemo, useState, type ChangeEvent } from 'react'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { round2 } from '../../lib/calc/invoices'
import { billGstAmt } from '../../lib/calc/vendorBills'
import {
  buildGstr1,
  buildGstr3b,
  reconcile2b,
  type InwardRow,
  type OutwardRow,
  type PortalRow,
  type Reconciliation,
} from '../../lib/calc/gstReturns'
import { parseGstr2bRows } from '../../lib/import/gstr2b'
import { stateCodeOfGstin, stateLabelOfGstin } from '../../lib/gst'
import { getErrorMessage } from '../../lib/errors'
import { useInvoices } from '../../lib/queries/invoices'
import { useClients, useVendors } from '../../lib/queries/masters'
import { useCompanyProfile, useInvoiceNotes } from '../../lib/queries/books'
import { useVendorBills } from '../../lib/queries/purchases'
import { clientLabel } from '../../lib/labels'
import { companyHeaderLine } from '../invoices/ledgerExport'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { DateRange } from '../../lib/calc/reportPeriod'

/** GST return working papers for the period: GSTR-3B (tax payable after input
 * credit), GSTR-1 (B2B, B2C, credit / debit notes, HSN summary) as Excel
 * sheets, and a match of purchase bills against a GSTR-2B file from the portal. */
export function GstReturnsReport({ range }: { range: DateRange | null }) {
  const { data: invoices } = useInvoices(null)
  const { data: notes } = useInvoiceNotes()
  const { data: clients } = useClients()
  const { data: bills } = useVendorBills(null)
  const { data: vendors } = useVendors()
  const { data: company } = useCompanyProfile()
  const companyState = stateCodeOfGstin(company?.gstin) || (company?.state_code ?? '')

  const inRange = (d: string | null | undefined) => !!d && (!range?.from || d >= range.from) && (!range?.to || d <= range.to)

  const { outward, inward } = useMemo(() => {
    const out: OutwardRow[] = []
    const clientOf = (id: string) => clients?.find((c) => c.id === id)
    for (const inv of invoices ?? []) {
      if (inv.status !== 'sent' || !inRange(inv.invoice_date)) continue
      const c = clientOf(inv.client_id)
      out.push({
        kind: 'invoice',
        number: inv.invoice_number ?? inv.display_id ?? '',
        date: inv.invoice_date as string,
        gstin: c?.gst ?? '',
        name: clientLabel(c),
        taxable: inv.amount,
        gst: round2((inv.amount * Number(inv.gst_pct || 0)) / 100),
        rate: Number(inv.gst_pct || 0),
        hsn: inv.hsn_sac ?? '',
        description: inv.description ?? '',
      })
    }
    for (const n of notes ?? []) {
      const inv = (invoices ?? []).find((i) => i.id === n.invoice_id)
      if (!inv || !inRange(n.date)) continue
      const c = clientOf(inv.client_id)
      const sign = n.note_type === 'credit' ? -1 : 1
      out.push({
        kind: n.note_type === 'credit' ? 'credit' : 'debit',
        number: n.display_id ?? '',
        date: n.date,
        againstNumber: inv.invoice_number ?? inv.display_id ?? '',
        gstin: c?.gst ?? '',
        name: clientLabel(c),
        taxable: sign * Number(n.amount),
        gst: sign * Number(n.gst_amount),
        rate: Number(n.gst_pct || 0),
        hsn: inv.hsn_sac ?? '',
        description: inv.description ?? '',
      })
    }
    const inn: InwardRow[] = []
    for (const b of bills ?? []) {
      if (!b.date || !inRange(b.date)) continue
      const v = vendors?.find((x) => x.id === b.vendor_id)
      inn.push({
        number: b.vendor_invoice_no ?? '',
        date: b.vendor_invoice_date ?? b.date,
        gstin: v?.gstin ?? '',
        name: v?.name ?? '',
        taxable: Number(b.amount || 0) + Number(b.other_cost || 0),
        gst: billGstAmt(b),
      })
    }
    return { outward: out, inward: inn }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, notes, clients, bills, vendors, range?.from, range?.to])

  const g1 = useMemo(() => buildGstr1(outward, companyState), [outward, companyState])
  const g3b = useMemo(() => buildGstr3b(outward, inward, companyState), [outward, inward, companyState])

  const [portal, setPortal] = useState<PortalRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const recon: Reconciliation | null = useMemo(() => (portal ? reconcile2b(inward, portal) : null), [portal, inward])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = wb.Sheets['B2B'] ?? wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
      setPortal(parseGstr2bRows(rows))
      setFileName(file.name)
    } catch (err) {
      setPortal(null)
      setFileError(getErrorMessage(err, 'Could not read that file.'))
    }
  }

  // Every sheet shows amounts to the paisa.
  const head = (s: ExportSection): ExportSection => ({ decimals: 2, ...s })
  const place = (gstin: string) => stateLabelOfGstin(gstin) || '—'
  const dateOf = (d: string) => fmtDate(d)

  const sections: ExportSection[] = [
    head({
      title: 'GSTR-3B summary',
      columns: ['Table', 'Taxable value', 'IGST', 'CGST', 'SGST / UTGST', 'Not split'],
      rows: [
        ['3.1(a) Outward taxable supplies', g3b.outward.taxable, g3b.outward.igst, g3b.outward.cgst, g3b.outward.sgst, g3b.outward.unsplit],
        ['4(A) Input tax credit available (purchase bills)', 0, g3b.itc.igst, g3b.itc.cgst, g3b.itc.sgst, g3b.itc.unsplit],
        ['Tax payable in cash (before utilising credit across heads)', 0, g3b.payable.igst, g3b.payable.cgst, g3b.payable.sgst, g3b.payable.unsplit],
      ],
      boldRows: [2],
    }),
    head({
      title: 'GSTR-1 B2B',
      columns: ['GSTIN', 'Receiver', 'Invoice no.', 'Date', 'Invoice value', 'Place of supply', 'Rate %', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Not split'],
      rows: g1.b2b.map((l) => [l.gstin, l.name, l.number, dateOf(l.date), l.value, place(l.gstin), l.rate, l.taxable, l.igst, l.cgst, l.sgst, l.unsplit]),
      numericColumns: [4, 7, 8, 9, 10, 11],
    }),
    head({
      title: 'GSTR-1 B2C',
      columns: ['Customer', 'Invoice no.', 'Date', 'Invoice value', 'Rate %', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Not split'],
      rows: g1.b2c.map((l) => [l.name, l.number, dateOf(l.date), l.value, l.rate, l.taxable, l.igst, l.cgst, l.sgst, l.unsplit]),
      numericColumns: [3, 5, 6, 7, 8, 9],
    }),
    head({
      title: 'GSTR-1 Credit and debit notes',
      columns: ['GSTIN', 'Receiver', 'Note no.', 'Date', 'Type', 'Against invoice', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Not split'],
      rows: g1.cdn.map((l) => [l.gstin || 'Unregistered', l.name, l.number, dateOf(l.date), l.kind === 'credit' ? 'Credit' : 'Debit', l.againstNumber ?? '', l.taxable, l.igst, l.cgst, l.sgst, l.unsplit]),
      numericColumns: [6, 7, 8, 9, 10],
    }),
    head({
      title: 'GSTR-1 HSN summary',
      columns: ['HSN / SAC', 'Description', 'Taxable value', 'Total value', 'IGST', 'CGST', 'SGST', 'Not split'],
      rows: g1.hsn.map((h) => [h.hsn, h.description, h.taxable, h.value, h.igst, h.cgst, h.sgst, h.unsplit]),
      numericColumns: [2, 3, 4, 5, 6, 7],
    }),
  ]

  const reconSections: ExportSection[] = recon
    ? [
        {
          title: 'Matched',
          columns: ['Supplier GSTIN', 'Supplier', 'Invoice no.', 'Tax in books', 'Tax in GSTR-2B'],
          rows: recon.matched.map((m) => [m.books.gstin, m.books.name, m.books.number, m.books.gst, m.portal.tax]),
          numericColumns: [3, 4],
          decimals: 2,
        },
        {
          title: 'Tax differs',
          columns: ['Supplier GSTIN', 'Supplier', 'Invoice no.', 'Tax in books', 'Tax in GSTR-2B', 'Difference'],
          rows: recon.mismatched.map((m) => [m.books.gstin, m.books.name, m.books.number, m.books.gst, m.portal.tax, m.taxDifference]),
          numericColumns: [3, 4, 5],
          decimals: 2,
        },
        {
          title: 'In books, not in 2B',
          columns: ['Supplier GSTIN', 'Supplier', 'Invoice no.', 'Date', 'Tax (credit not yet claimable)'],
          rows: recon.missingIn2b.map((b) => [b.gstin || 'Unregistered', b.name, b.number || '(no number)', dateOf(b.date), b.gst]),
          numericColumns: [4],
          decimals: 2,
        },
        {
          title: 'In 2B, not in books',
          columns: ['Supplier GSTIN', 'Invoice no.', 'Date', 'Taxable value', 'Tax'],
          rows: recon.missingInBooks.map((p) => [p.gstin, p.number, p.date ?? '', p.taxable, p.tax]),
          numericColumns: [3, 4],
          decimals: 2,
        },
      ]
    : []

  const unsplitTotal = round2(g3b.outward.unsplit + g3b.itc.unsplit)
  const noGstin = g1.b2c.length
  const noHsn = g1.hsn.find((h) => h.hsn === 'Not set')

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Working papers for the period: invoices and credit / debit notes dated in it, and purchase bills dated in it. Check the figures here, then
        enter them on the GST portal. Credit set against tax in one head is not moved across heads here — the portal does that when you file.
      </div>

      {(!companyState || unsplitTotal > 0 || noGstin > 0 || noHsn) && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {!companyState && 'Your GSTIN is not set (Settings), so tax cannot be split into CGST / SGST / IGST. '}
          {companyState && unsplitTotal > 0 && `${fmt2(unsplitTotal)} of tax is not split because a client or vendor has no GSTIN. `}
          {noGstin > 0 && `${noGstin} invoice${noGstin === 1 ? '' : 's'} are to clients without a GSTIN and go under B2C. `}
          {noHsn && 'Some invoices have no HSN / SAC code, which the HSN summary needs.'}
        </div>
      )}

      <ReportExportButtons title="GST return workings" sections={sections} range={range} headerNote={companyHeaderLine(company)} fileNamePrefix="GST_Return_Workings" />

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>GSTR-3B</h3>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Table</th>
              <th style={{ textAlign: 'right' }}>Taxable value</th>
              <th style={{ textAlign: 'right' }}>IGST</th>
              <th style={{ textAlign: 'right' }}>CGST</th>
              <th style={{ textAlign: 'right' }}>SGST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3.1(a) Outward taxable supplies</td>
              <td className="amt">{fmt2(g3b.outward.taxable)}</td>
              <td className="amt">{fmt2(g3b.outward.igst)}</td>
              <td className="amt">{fmt2(g3b.outward.cgst)}</td>
              <td className="amt">{fmt2(g3b.outward.sgst)}</td>
            </tr>
            <tr>
              <td>4(A) Input tax credit (purchase bills)</td>
              <td className="amt">—</td>
              <td className="amt">{fmt2(g3b.itc.igst)}</td>
              <td className="amt">{fmt2(g3b.itc.cgst)}</td>
              <td className="amt">{fmt2(g3b.itc.sgst)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600 }}>
              <td>Tax payable after input credit</td>
              <td className="amt">—</td>
              <td className="amt">{fmt2(g3b.payable.igst)}</td>
              <td className="amt">{fmt2(g3b.payable.cgst)}</td>
              <td className="amt">{fmt2(g3b.payable.sgst)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="note">
        Input credit counts purchase bills only. GST on approved expenses is not included, because expenses do not carry the supplier's GSTIN.
      </div>

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>GSTR-1</h3>
      <div className="note" style={{ marginTop: 0 }}>
        {g1.b2b.length} B2B invoice{g1.b2b.length === 1 ? '' : 's'}, {g1.b2c.length} B2C, {g1.cdn.length} credit / debit note{g1.cdn.length === 1 ? '' : 's'}, {g1.hsn.length} HSN / SAC
        code{g1.hsn.length === 1 ? '' : 's'}. Download the workings above for every table, ready to copy into the portal or an offline tool.
      </div>

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>Match purchases with GSTR-2B</h3>
      <div className="note" style={{ marginTop: 0 }}>
        Download GSTR-2B for the month from the GST portal (Excel) and choose it here. Bills with GST that are missing from 2B cannot be claimed yet.
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onFile(e)} aria-label="GSTR-2B file" />
      {fileError && (
        <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>
          {fileError}
        </div>
      )}
      {recon && (
        <>
          <div className="note">
            {fileName}: {recon.matched.length} matched, {recon.mismatched.length} with a tax difference, {recon.missingIn2b.length} in your books but not in 2B,{' '}
            {recon.missingInBooks.length} in 2B but not in your books.
          </div>
          <ReportExportButtons title="GSTR-2B matching" sections={reconSections} range={range} fileNamePrefix="GSTR2B_Matching" />
          <ReconTable title="Tax differs" empty="None" head={['Supplier', 'Invoice', 'Books', '2B', 'Difference']}>
            {recon.mismatched.map((m, i) => (
              <tr key={i}>
                <td>{m.books.name || m.books.gstin}</td>
                <td>{m.books.number}</td>
                <td className="amt">{fmt2(m.books.gst)}</td>
                <td className="amt">{fmt2(m.portal.tax)}</td>
                <td className="amt">{fmt2(m.taxDifference)}</td>
              </tr>
            ))}
          </ReconTable>
          <ReconTable title="In your books, not in 2B (credit at risk)" empty="None" head={['Supplier', 'Invoice', 'Date', 'Tax']}>
            {recon.missingIn2b.map((b, i) => (
              <tr key={i}>
                <td>{b.name || b.gstin || 'Unregistered'}</td>
                <td>{b.number || '(no number)'}</td>
                <td>{dateOf(b.date)}</td>
                <td className="amt">{fmt2(b.gst)}</td>
              </tr>
            ))}
          </ReconTable>
          <ReconTable title="In 2B, not in your books" empty="None" head={['Supplier GSTIN', 'Invoice', 'Taxable', 'Tax']}>
            {recon.missingInBooks.map((p, i) => (
              <tr key={i}>
                <td>{p.gstin}</td>
                <td>{p.number}</td>
                <td className="amt">{fmt2(p.taxable)}</td>
                <td className="amt">{fmt2(p.tax)}</td>
              </tr>
            ))}
          </ReconTable>
        </>
      )}
    </div>
  )
}

function ReconTable({ title, head, empty, children }: { title: string; head: string[]; empty: string; children: React.ReactNode[] }) {
  return (
    <>
      <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>{title}</h4>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} style={i >= head.length - (head.length > 4 ? 3 : 1) ? { textAlign: 'right' } : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children.length === 0 ? (
              <tr>
                <td colSpan={head.length} className="empty-row">
                  {empty}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
