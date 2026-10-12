import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { gstAmt, gstReleased, round2 } from '../../lib/calc/invoices'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { useClients } from '../../lib/queries/masters'
import { useCompanyProfile } from '../../lib/queries/books'
import { clientFullName, clientLabel } from '../../lib/labels'
import { companyHeaderLine } from '../invoices/ledgerExport'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

/** For a client that releases GST only after proof of deposit: invoice by
 * invoice, the GST charged, when it was deposited (GSTR-3B) and the proof sent,
 * what the client has released, and what is still pending — the statement to
 * send them. Not scoped to the period filter. */
export function GstReleaseStatementReport() {
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const { data: clients } = useClients()
  const { data: company } = useCompanyProfile()
  const [clientId, setClientId] = useState('')

  const holdClients = (clients ?? []).filter((c) => c.gst_on_proof || (invoices ?? []).some((i) => i.client_id === c.id && i.gst_on_hold))
  const client = clients?.find((c) => c.id === clientId)

  const rows = (invoices ?? [])
    .filter((i) => i.client_id === clientId && i.status === 'sent' && i.gst_on_hold)
    .sort((a, b) => (a.invoice_date ?? '').localeCompare(b.invoice_date ?? ''))
    .map((inv) => {
      const invPayments = (payments ?? []).filter((p) => p.invoice_id === inv.id)
      const gst = gstAmt(inv)
      const released = round2(gstReleased(inv, invPayments))
      return { inv, gst, released, pending: round2(Math.max(0, gst - released)), deposited: !!inv.gstr3b_filed_on }
    })

  const sum = (pick: (r: (typeof rows)[number]) => number) => round2(rows.reduce((s, r) => s + pick(r), 0))
  const totals = {
    gst: sum((r) => r.gst),
    deposited: sum((r) => (r.deposited ? r.gst : 0)),
    released: sum((r) => r.released),
    pending: sum((r) => r.pending),
  }
  const depositedNotReleased = round2(Math.max(0, totals.deposited - totals.released))

  const sections: ExportSection[] = client
    ? [
        {
          title: `${clientFullName(client)} - GST release statement`,
          sheetName: `${clientLabel(client)} - GST`,
          subtitle: [
            `${clientFullName(client)} - GST release statement`,
            client.gst ? `GSTIN: ${client.gst}` : '',
            `GST charged ${fmt2(totals.gst)}  |  deposited with the government ${fmt2(totals.deposited)}  |  released by you ${fmt2(totals.released)}  |  deposited, awaiting release ${fmt2(depositedNotReleased)}`,
          ].filter(Boolean),
          columns: ['Invoice', 'Date', 'Taxable value', 'GST charged', 'GSTR-3B period', 'Deposited on', 'Proof sent on', 'GST released', 'GST pending'],
          rows: [
            ...rows.map((r) => [
              r.inv.invoice_number ?? r.inv.display_id ?? '',
              fmtDate(r.inv.invoice_date),
              Number(r.inv.amount) + Number(r.inv.adj_amount || 0),
              r.gst,
              r.inv.gstr3b_period ?? '-',
              r.inv.gstr3b_filed_on ? fmtDate(r.inv.gstr3b_filed_on) : '-',
              r.inv.gstr3b_sent_on ? fmtDate(r.inv.gstr3b_sent_on) : '-',
              r.released,
              r.pending,
            ]),
            ['Total', '', sum((r) => Number(r.inv.amount) + Number(r.inv.adj_amount || 0)), totals.gst, '', '', '', totals.released, totals.pending],
          ],
          numericColumns: [2, 3, 7, 8],
          decimals: 2,
          columnWidths: { 1: 24, 5: 24, 6: 24 },
          boldRows: [rows.length],
        },
      ]
    : []

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        For clients that release GST only after we deposit it (GSTR-3B) and send proof. Pick a client to see, invoice by invoice, what was
        charged, deposited, proved and released, and what is still pending.
      </div>

      <div className="field" style={{ maxWidth: 320, marginTop: 12 }}>
        <label>Client</label>
        <SearchableSelect
          items={holdClients.length > 0 ? holdClients : clients}
          value={clientId}
          onChange={setClientId}
          getId={(c) => c.id}
          getLabel={(c) => clientLabel(c)}
          placeholder="— Select client —"
        />
        {holdClients.length === 0 && (
          <div className="note">No client is set up for this yet. Tick "Releases GST only after GSTR-3B proof" on the client, or on an invoice.</div>
        )}
      </div>

      {client && (
        <>
          <div className="dash-grid" style={{ marginTop: 12 }}>
            <div className="dash-card">
              <div className="dash-label">GST charged</div>
              <div className="dash-value">{fmt2(totals.gst)}</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Deposited with government</div>
              <div className="dash-value">{fmt2(totals.deposited)}</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Released by client</div>
              <div className="dash-value">{fmt2(totals.released)}</div>
            </div>
            <div className={`dash-card ${depositedNotReleased > 0.01 ? 'dash-card-warn' : 'dash-card-good'}`}>
              <div className="dash-label">Deposited, awaiting release</div>
              <div className="dash-value">{fmt2(depositedNotReleased)}</div>
            </div>
          </div>

          <ReportExportButtons title="GST release statement" sections={sections} range={null} headerNote={companyHeaderLine(company)} fileNamePrefix={`${clientLabel(client)}_GST_release`} />

          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>GST charged</th>
                  <th>GSTR-3B</th>
                  <th>Deposited on</th>
                  <th>Proof sent on</th>
                  <th style={{ textAlign: 'right' }}>Released</th>
                  <th style={{ textAlign: 'right' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      None of this client's invoices is set to release GST on proof
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.inv.id}>
                    <td>{r.inv.invoice_number ?? r.inv.display_id}</td>
                    <td>{fmtDate(r.inv.invoice_date)}</td>
                    <td className="amt">{fmt2(r.gst)}</td>
                    <td>{r.inv.gstr3b_period ?? '-'}</td>
                    <td>{r.inv.gstr3b_filed_on ? fmtDate(r.inv.gstr3b_filed_on) : '-'}</td>
                    <td>{r.inv.gstr3b_sent_on ? fmtDate(r.inv.gstr3b_sent_on) : '-'}</td>
                    <td className="amt">{fmt2(r.released)}</td>
                    <td className={r.pending > 0.01 ? 'amt amt-due' : 'amt'}>{fmt2(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={2}>Total</td>
                    <td className="amt">{fmt2(totals.gst)}</td>
                    <td colSpan={3}></td>
                    <td className="amt">{fmt2(totals.released)}</td>
                    <td className="amt">{fmt2(totals.pending)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
