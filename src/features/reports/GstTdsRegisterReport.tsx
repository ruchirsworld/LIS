import { fmt2, fmtDate } from '../../lib/calc/format'
import { round2 } from '../../lib/calc/invoices'
import { useInvoices } from '../../lib/queries/invoices'
import { useClients } from '../../lib/queries/masters'
import { useCompanyProfile, useInvoiceNotes } from '../../lib/queries/books'
import { clientLabel } from '../../lib/labels'
import { stateCodeOfGstin, stateLabelOfGstin } from '../../lib/gst'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { DateRange } from '../../lib/calc/reportPeriod'

interface Row {
  date: string
  type: string
  number: string
  client: string
  gstin: string
  place: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  unsplit: number
  tds: number
}

/** Outward supplies for the period, invoice by invoice — taxable value, GST
 * split into CGST / SGST / IGST by place of supply, and the TDS deducted — the
 * working papers behind GSTR-1 / GSTR-3B and the TDS to claim against Form
 * 26AS. Credit notes show as negatives, debit notes as positives. */
export function GstTdsRegisterReport({ range }: { range: DateRange | null }) {
  const { data: invoices } = useInvoices(null)
  const { data: notes } = useInvoiceNotes()
  const { data: clients } = useClients()
  const { data: company } = useCompanyProfile()
  const companyState = stateCodeOfGstin(company?.gstin) || (company?.state_code ?? '')

  const inRange = (d: string | null | undefined) => !!d && (!range?.from || d >= range.from) && (!range?.to || d <= range.to)

  const split = (gst: number, clientGstin: string | null | undefined) => {
    const clientState = stateCodeOfGstin(clientGstin)
    if (gst === 0) return { cgst: 0, sgst: 0, igst: 0, unsplit: 0 }
    if (companyState && clientState) {
      if (companyState === clientState) {
        const cgst = round2(gst / 2)
        return { cgst, sgst: round2(gst - cgst), igst: 0, unsplit: 0 }
      }
      return { cgst: 0, sgst: 0, igst: gst, unsplit: 0 }
    }
    return { cgst: 0, sgst: 0, igst: 0, unsplit: gst }
  }

  const clientOf = (id: string) => clients?.find((c) => c.id === id)
  const rows: Row[] = []
  for (const inv of invoices ?? []) {
    if (inv.status !== 'sent' || !inRange(inv.invoice_date)) continue
    const c = clientOf(inv.client_id)
    const gst = round2((inv.amount * Number(inv.gst_pct || 0)) / 100)
    rows.push({
      date: inv.invoice_date as string,
      type: 'Invoice',
      number: inv.invoice_number ?? inv.display_id ?? '',
      client: clientLabel(c),
      gstin: c?.gst ?? '',
      place: stateLabelOfGstin(c?.gst) || '—',
      taxable: inv.amount,
      ...split(gst, c?.gst),
      tds: round2((inv.amount * Number(inv.tds_pct || 0)) / 100),
    })
  }
  for (const n of notes ?? []) {
    const inv = (invoices ?? []).find((i) => i.id === n.invoice_id)
    if (!inv || !inRange(n.date)) continue
    const c = clientOf(inv.client_id)
    const sign = n.note_type === 'credit' ? -1 : 1
    const s = split(Number(n.gst_amount), c?.gst)
    rows.push({
      date: n.date,
      type: n.note_type === 'credit' ? 'Credit note' : 'Debit note',
      number: n.display_id ?? '',
      client: clientLabel(c),
      gstin: c?.gst ?? '',
      place: stateLabelOfGstin(c?.gst) || '—',
      taxable: sign * Number(n.amount),
      cgst: sign * s.cgst,
      sgst: sign * s.sgst,
      igst: sign * s.igst,
      unsplit: sign * s.unsplit,
      tds: sign * Number(n.tds_amount),
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
  }
  const value = (r: Row) => r.taxable + r.cgst + r.sgst + r.igst + r.unsplit

  const sections: ExportSection[] = [
    {
      title: 'GST & TDS register',
      columns: ['Date', 'Type', 'No.', 'Client', 'GSTIN', 'Place of supply', 'Taxable value', 'CGST', 'SGST', 'IGST', 'GST (not split)', 'Invoice value', 'TDS'],
      rows: [
        ...rows.map((r) => [fmtDate(r.date), r.type, r.number, r.client, r.gstin || 'Unregistered', r.place, r.taxable, r.cgst, r.sgst, r.igst, r.unsplit, round2(value(r)), r.tds]),
        ['', 'Total', '', '', '', '', total.taxable, total.cgst, total.sgst, total.igst, total.unsplit, round2(total.taxable + total.cgst + total.sgst + total.igst + total.unsplit), total.tds],
      ],
      numericColumns: [6, 7, 8, 9, 10, 11, 12],
      decimals: 2,
      boldRows: [rows.length],
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Invoices and credit / debit notes dated in the period. GST is split by place of supply using your GSTIN
        {companyState ? '' : ' (not set yet — add it in Settings; until then GST shows under "not split")'} and each client's GSTIN.
      </div>
      <ReportExportButtons title="GST & TDS register" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>No.</th>
              <th>Client</th>
              <th>Place of supply</th>
              <th style={{ textAlign: 'right' }}>Taxable</th>
              <th style={{ textAlign: 'right' }}>CGST</th>
              <th style={{ textAlign: 'right' }}>SGST</th>
              <th style={{ textAlign: 'right' }}>IGST</th>
              <th style={{ textAlign: 'right' }}>Not split</th>
              <th style={{ textAlign: 'right' }}>TDS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No invoices in this period
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.number}-${i}`}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.type}</td>
                <td>{r.number}</td>
                <td>
                  {r.client}
                  <div className="retention-note">{r.gstin || 'Unregistered'}</div>
                </td>
                <td>{r.place}</td>
                <td className="amt">{fmt2(r.taxable)}</td>
                <td className="amt">{fmt2(r.cgst)}</td>
                <td className="amt">{fmt2(r.sgst)}</td>
                <td className="amt">{fmt2(r.igst)}</td>
                <td className="amt">{fmt2(r.unsplit)}</td>
                <td className="amt">{fmt2(r.tds)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={5}>Total</td>
                <td className="amt">{fmt2(total.taxable)}</td>
                <td className="amt">{fmt2(total.cgst)}</td>
                <td className="amt">{fmt2(total.sgst)}</td>
                <td className="amt">{fmt2(total.igst)}</td>
                <td className="amt">{fmt2(total.unsplit)}</td>
                <td className="amt">{fmt2(total.tds)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
