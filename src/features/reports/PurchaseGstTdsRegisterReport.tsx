import { fmt2, fmtDate } from '../../lib/calc/format'
import { round2 } from '../../lib/calc/invoices'
import { billGstAmt, billTdsAmt } from '../../lib/calc/vendorBills'
import { useVendorBills } from '../../lib/queries/purchases'
import { useVendors } from '../../lib/queries/masters'
import { useCompanyProfile } from '../../lib/queries/books'
import { stateCodeOfGstin } from '../../lib/gst'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { DateRange } from '../../lib/calc/reportPeriod'

interface Row {
  date: string
  number: string
  supplierInvoice: string
  vendor: string
  gstin: string
  pan: string
  section: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  unsplit: number
  tds: number
  payable: number
}

/** Purchases for the period, bill by bill — taxable value, the input GST you
 * can claim split into CGST / SGST / IGST by the supplier's state, and the
 * TDS you deducted with the vendor's PAN and section: the working papers
 * for GSTR-3B input credit, 2B matching and Form 26Q. */
export function PurchaseGstTdsRegisterReport({ range }: { range: DateRange | null }) {
  const { data: bills } = useVendorBills(null)
  const { data: vendors } = useVendors()
  const { data: company } = useCompanyProfile()
  const companyState = stateCodeOfGstin(company?.gstin) || (company?.state_code ?? '')

  const rows: Row[] = []
  for (const b of bills ?? []) {
    if (!b.date || (range?.from && b.date < range.from) || (range?.to && b.date > range.to)) continue
    const v = vendors?.find((x) => x.id === b.vendor_id)
    const gst = billGstAmt(b)
    const vendorState = stateCodeOfGstin(v?.gstin)
    let cgst = 0
    let sgst = 0
    let igst = 0
    let unsplit = 0
    if (gst > 0) {
      if (companyState && vendorState) {
        if (companyState === vendorState) {
          cgst = round2(gst / 2)
          sgst = round2(gst - cgst)
        } else igst = gst
      } else unsplit = gst
    }
    const taxable = Number(b.amount || 0) + Number(b.other_cost || 0)
    const tds = billTdsAmt(b)
    rows.push({
      date: b.date,
      number: b.display_id ?? '',
      supplierInvoice: [b.vendor_invoice_no, b.vendor_invoice_date ? fmtDate(b.vendor_invoice_date) : ''].filter(Boolean).join(' / '),
      vendor: v?.name ?? '',
      gstin: v?.gstin ?? '',
      pan: v?.pan ?? '',
      section: b.tds_section ? `${b.tds_section} @${b.tds_pct}%` : '',
      taxable,
      cgst,
      sgst,
      igst,
      unsplit,
      tds,
      payable: round2(taxable + gst - tds),
    })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))

  const sum = (pick: (r: Row) => number) => round2(rows.reduce((s, r) => s + pick(r), 0))
  const total = {
    taxable: sum((r) => r.taxable),
    cgst: sum((r) => r.cgst),
    sgst: sum((r) => r.sgst),
    igst: sum((r) => r.igst),
    unsplit: sum((r) => r.unsplit),
    tds: sum((r) => r.tds),
    payable: sum((r) => r.payable),
  }

  const sections: ExportSection[] = [
    {
      title: 'Purchase GST & TDS register',
      columns: ['Date', 'Bill', 'Supplier invoice', 'Vendor', 'GSTIN', 'PAN', 'TDS', 'Taxable value', 'Input CGST', 'Input SGST', 'Input IGST', 'GST (not split)', 'TDS deducted', 'Payable'],
      rows: [
        ...rows.map((r) => [fmtDate(r.date), r.number, r.supplierInvoice, r.vendor, r.gstin || 'Unregistered', r.pan, r.section, r.taxable, r.cgst, r.sgst, r.igst, r.unsplit, r.tds, r.payable]),
        ['', 'Total', '', '', '', '', '', total.taxable, total.cgst, total.sgst, total.igst, total.unsplit, total.tds, total.payable],
      ],
      numericColumns: [7, 8, 9, 10, 11, 12, 13],
      decimals: 2,
      columnWidths: { 0: 24 },
      boldRows: [rows.length],
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Vendor bills dated in the period. Input GST is split by the supplier's GSTIN against yours
        {companyState ? '' : ' (your GSTIN is not set yet, so it shows as "not split")'}; a supplier with no GSTIN cannot give you input credit.
      </div>
      <ReportExportButtons title="Purchase GST & TDS register" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bill</th>
              <th>Vendor</th>
              <th>TDS</th>
              <th style={{ textAlign: 'right' }}>Taxable</th>
              <th style={{ textAlign: 'right' }}>CGST</th>
              <th style={{ textAlign: 'right' }}>SGST</th>
              <th style={{ textAlign: 'right' }}>IGST</th>
              <th style={{ textAlign: 'right' }}>Not split</th>
              <th style={{ textAlign: 'right' }}>TDS deducted</th>
              <th style={{ textAlign: 'right' }}>Payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No vendor bills in this period
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.number}-${i}`}>
                <td>{fmtDate(r.date)}</td>
                <td>
                  {r.number}
                  {r.supplierInvoice && <div className="retention-note">{r.supplierInvoice}</div>}
                </td>
                <td>
                  {r.vendor}
                  <div className="retention-note">{[r.gstin || 'Unregistered', r.pan].filter(Boolean).join(' / ')}</div>
                </td>
                <td>{r.section || '-'}</td>
                <td className="amt">{fmt2(r.taxable)}</td>
                <td className="amt">{fmt2(r.cgst)}</td>
                <td className="amt">{fmt2(r.sgst)}</td>
                <td className="amt">{fmt2(r.igst)}</td>
                <td className="amt">{fmt2(r.unsplit)}</td>
                <td className="amt">{fmt2(r.tds)}</td>
                <td className="amt">{fmt2(r.payable)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={4}>Total</td>
                <td className="amt">{fmt2(total.taxable)}</td>
                <td className="amt">{fmt2(total.cgst)}</td>
                <td className="amt">{fmt2(total.sgst)}</td>
                <td className="amt">{fmt2(total.igst)}</td>
                <td className="amt">{fmt2(total.unsplit)}</td>
                <td className="amt">{fmt2(total.tds)}</td>
                <td className="amt">{fmt2(total.payable)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
