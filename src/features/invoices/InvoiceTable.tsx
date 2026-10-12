import { confirmAction } from '../../lib/feedback'
import { Fragment, useEffect, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { useInvoices, useInvoicePayments, useDeleteInvoice, useCycleInvoiceStatus, useMovePaymentExcess } from '../../lib/queries/invoices'
import { useClients, useProjects } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { gstAmt, tdsAmt, netPayable, retentionAmt, totalPaid, dueAmount, extraPaid, retentionHeld, isRetentionReleaseDue, gstHeld as gstHeldOf, effectiveDueDate, effectiveStatus } from '../../lib/calc/invoices'
import type { DateRange } from '../../lib/calc/period'
import { InvoicePaymentForm, EditInvoicePaymentFields } from './InvoicePaymentForm'
import { GstReleaseForm } from './GstReleaseForm'
import { clientLabel, clientFullName } from '../../lib/labels'
import { useAuth } from '../../lib/auth'
import { useInvoiceNotes, useCompanyProfile, useDeleteInvoiceNote } from '../../lib/queries/books'
import { buildLedgerSections, companyHeaderLine } from './ledgerExport'
import { InvoiceNoteForm } from './InvoiceNoteForm'
import { downloadTaxDocumentPdf } from '../../lib/export/taxInvoice'
import { useNavFilter, type InvoiceView } from '../../lib/navContext'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

export function InvoiceTable({ onEdit }: { onEdit: (invoice: Invoice) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [view, setView] = useState<InvoiceView>('all')
  // Arriving from a dashboard card or table row: narrow to what it counted.
  const nav = useNavFilter('invoices')
  useEffect(() => {
    if (!nav) return
    setClientFilter(nav.filter.clientId ?? '')
    setView(nav.filter.invoiceView ?? 'all')
  }, [nav])
  const { data: invoices, isLoading } = useInvoices(range)
  const { data: allInvoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const deleteInvoice = useDeleteInvoice()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { data: notes } = useInvoiceNotes()
  const { data: company } = useCompanyProfile()
  const deleteNote = useDeleteInvoiceNote()
  const [pdfError, setPdfError] = useState<string | null>(null)

  // The tax invoice (or a credit / debit note) as a PDF for the client.
  async function downloadDocument(inv: Invoice, note?: NonNullable<typeof notes>[number]) {
    setPdfError(null)
    try {
      await downloadTaxDocumentPdf({
        invoice: inv,
        client: clients?.find((c) => c.id === inv.client_id),
        company,
        project: inv.project_id ? projects?.find((p) => p.id === inv.project_id) : null,
        note,
        dueDate: effectiveDueDate(inv),
      })
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not create the PDF.')
    }
  }
  const [noteForm, setNoteForm] = useState<{ invoiceId: string; type: 'credit' | 'debit' } | null>(null)
  const cycleStatus = useCycleInvoiceStatus()
  const movePaymentExcess = useMovePaymentExcess()
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const [payFormRelease, setPayFormRelease] = useState(false)
  // Opens the payment form as a GST release, pre-filled with this GST amount.
  const [payFormGst, setPayFormGst] = useState(0)
  const [gstFormId, setGstFormId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

  const clientNameOf = (inv: Invoice) => clientLabel(clients?.find((c) => c.id === inv.client_id))
  const projectNameOf = (inv: Invoice) => (inv.project_id ? projects?.find((p) => p.id === inv.project_id)?.name : '') ?? ''
  const paidOf = (inv: Invoice) => totalPaid(payments?.filter((p) => p.invoice_id === inv.id) ?? [])
  const dueOf = (inv: Invoice) => dueAmount(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? [])

  // The client's next invoice that still has something due, other than the
  // one holding the extra — oldest first, and only ones dated on/after it so
  // "next" really means the following bill, not an earlier one.
  const nextOpenInvoiceFor = (inv: Invoice) =>
    (allInvoices ?? [])
      .filter(
        (o) =>
          o.id !== inv.id &&
          o.client_id === inv.client_id &&
          (o.invoice_date ?? '9999-99-99') >= (inv.invoice_date ?? '') &&
          dueOf(o) > 0.01
      )
      .sort((a, b) => (a.invoice_date ?? '9999-99-99').localeCompare(b.invoice_date ?? '9999-99-99'))[0]

  async function adjustExtraToNext(inv: Invoice, extra: number, target: Invoice) {
    setAdjustError(null)
    try {
      await movePaymentExcess.mutateAsync({
        // A retention release is never the "extra" — only ordinary payments move.
        payments: payments?.filter((p) => p.invoice_id === inv.id && !p.is_retention_release) ?? [],
        amount: Math.min(extra, dueOf(target)),
        targetInvoiceId: target.id,
        fromLabel: inv.invoice_number ?? inv.display_id ?? 'earlier invoice',
      })
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Could not adjust the extra payment.')
    }
  }

  const clientFiltered = clientFilter ? invoices?.filter((inv) => inv.client_id === clientFilter) : invoices
  const filteredInvoices =
    view === 'all'
      ? clientFiltered
      : clientFiltered?.filter((inv) => {
          const invPayments = payments?.filter((p) => p.invoice_id === inv.id) ?? []
          if (view === 'due') return inv.status === 'sent' && dueAmount(inv, invPayments) > 0.01
          if (view === 'overdue') return effectiveStatus(inv, invPayments) === 'overdue'
          if (view === 'draft') return inv.status === 'draft'
          if (view === 'gst') return gstHeldOf(inv, invPayments) > 0
          return retentionHeld(inv, invPayments) > 0
        })

  const { sorted: sortedInvoices, sortKey, direction, toggleSort } = useSort(
    filteredInvoices,
    {
      id: (inv) => inv.display_id,
      invoiceNo: (inv) => inv.invoice_number,
      client: (inv) => clientNameOf(inv),
      project: (inv) => projectNameOf(inv),
      invoiceDate: (inv) => inv.invoice_date,
      dueDate: (inv) => effectiveDueDate(inv),
      amount: (inv) => inv.amount,
      gst: (inv) => gstAmt(inv),
      tds: (inv) => tdsAmt(inv),
      netPayable: (inv) => netPayable(inv),
      retention: (inv) => retentionAmt(inv),
      paid: (inv) => paidOf(inv),
      due: (inv) => dueOf(inv),
      status: (inv) => effectiveStatus(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? []),
    },
    'invoiceDate'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedInvoices)

  const exportSections = buildLedgerSections({ clients, invoices: allInvoices, payments, notes, projects, range, clientFilter })
  // When narrowed to one client, the export should say so up front — full
  // name and GST in the document, client code in the downloaded filename —
  // rather than leaving the header as the generic "Ledger" title with no
  // per-section title (which only prints when there's more than one).
  const filterClient = clientFilter ? clients?.find((c) => c.id === clientFilter) : undefined
  const ledgerTitle = filterClient ? `${clientFullName(filterClient)} ledger` : 'Ledger'
  const ledgerFileNamePrefix = filterClient ? `${clientLabel(filterClient)}_Ledger` : 'Ledger'

  return (
    <details className="toggle-section" open id="inv-ledger">
      <summary>Ledger</summary>

      <div className="toolbar">
        <div className="toolbar-group">
          <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Client</label>
            <SearchableSelect
              items={clients}
              value={clientFilter}
              onChange={setClientFilter}
              getId={(c) => c.id}
              getLabel={(c) => clientLabel(c)}
              placeholder="— All clients —"
            />
          </div>
          <div className="field" style={{ maxWidth: 190 }}>
            <label>Show</label>
            <select value={view} onChange={(e) => setView(e.target.value as InvoiceView)}>
              <option value="all">All invoices</option>
              <option value="due">With a balance due</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Drafts to send</option>
              <option value="retention">Retention held</option>
              <option value="gst">GST held by client</option>
            </select>
          </div>
        </div>
        <ReportExportButtons
          title={ledgerTitle}
          sections={exportSections}
          range={range}
          style={{ marginTop: 0 }}
          headerNote={companyHeaderLine(company)}
          fileNamePrefix={ledgerFileNamePrefix}
        />
      </div>

      {adjustError && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {adjustError}
        </div>
      )}

      {pdfError && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {pdfError}
        </div>
      )}

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Invoice no." sortKey="invoiceNo" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client" sortKey="client" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Invoice date" sortKey="invoiceDate" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Due date" sortKey="dueDate" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="GST" sortKey="gst" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="TDS" sortKey="tds" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Net payable" sortKey="netPayable" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Retention" sortKey="retention" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={15} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedInvoices || sortedInvoices.length === 0) && (
              <tr>
                <td colSpan={15} className="empty-row">
                  No invoices in this period
                </td>
              </tr>
            )}
            {pageRows?.map((inv) => {
              const client = clients?.find((c) => c.id === inv.client_id)
              const project = inv.project_id ? projects?.find((p) => p.id === inv.project_id) : null
              const invPayments = payments?.filter((p) => p.invoice_id === inv.id) ?? []
              const paid = totalPaid(invPayments)
              const due = dueAmount(inv, invPayments)
              const extra = extraPaid(inv, invPayments)
              const held = retentionHeld(inv, invPayments)
              const releaseDue = isRetentionReleaseDue(inv, invPayments)
              const gstHeldAmt = gstHeldOf(inv, invPayments)
              const nextInvoice = extra > 0 ? nextOpenInvoiceFor(inv) : undefined
              const status = effectiveStatus(inv, invPayments)
              const dueDateDisplay = effectiveDueDate(inv)
              const hasHistory = invPayments.length > 0
              const canCycle = status === 'draft' || status === 'sent'

              return (
                <Fragment key={inv.id}>
                  <tr className={status === 'overdue' ? 'row-overdue' : due > 0.01 && inv.status === 'sent' ? 'row-due' : undefined}>
                    <td>{inv.display_id ?? '—'}</td>
                    <td>{inv.invoice_number ?? '—'}</td>
                    <td>{clientLabel(client)}</td>
                    <td>{project ? project.name : '—'}</td>
                    <td>{inv.invoice_date ? fmtDate(inv.invoice_date) : '— (not sent yet)'}</td>
                    <td>{dueDateDisplay ? fmtDate(dueDateDisplay) : '—'}</td>
                    <td className="amt">
                      {fmt(inv.amount + inv.adj_amount)}
                      {inv.adj_amount !== 0 && <div className="retention-note">revised by notes</div>}
                    </td>
                    <td className="amt">
                      {fmt(gstAmt(inv))} <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>({inv.gst_pct || 0}%)</span>
                    </td>
                    <td className="amt">
                      {fmt(tdsAmt(inv))} <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>({inv.tds_pct || 0}%)</span>
                    </td>
                    <td className="amt">{fmt(netPayable(inv))}</td>
                    <td className={inv.retention_pct && held > 0 ? 'amt amt-retention' : 'amt'}>
                      {inv.retention_pct ? (
                        <>
                          {fmt(retentionAmt(inv))} <span style={{ fontSize: 11, fontWeight: 400 }}>({inv.retention_pct}%)</span>
                          {inv.retention_release_date && (
                            <div className="retention-note">Release {fmtDate(inv.retention_release_date)}</div>
                          )}
                          {held > 0 && held < retentionAmt(inv) - 0.01 && (
                            <div className="retention-note">{fmt(held)} still held</div>
                          )}
                          {releaseDue && <div className="retention-note retention-due">Release due</div>}
                          {held === 0 && <div className="retention-note">Released</div>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">
                      {due > 0.01 ? (
                        <span className="amt-due">{fmt(due)}</span>
                      ) : extra > 0 ? (
                        <span className="amt-extra" title="Paid more than the invoice">
                          +{fmt(extra)} extra
                        </span>
                      ) : (
                        fmt(due)
                      )}
                      {inv.gst_on_hold && gstHeldAmt > 0 && (
                        <div className="gst-held-note" title="The client releases this GST after GSTR-3B proof">
                          GST held {fmt(gstHeldAmt)}
                          <span>
                            {!inv.gstr3b_filed_on
                              ? ' - not filed yet'
                              : !inv.gstr3b_sent_on
                                ? ` - filed ${fmtDate(inv.gstr3b_filed_on)}, proof not sent`
                                : ` - proof sent ${fmtDate(inv.gstr3b_sent_on)}`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {canCycle ? (
                        <button
                          type="button"
                          className={`badge ${status}`}
                          onClick={() =>
                            cycleStatus.mutate({ id: inv.id, status: inv.status, invoiceDate: inv.invoice_date })
                          }
                        >
                          {status}
                        </button>
                      ) : (
                        <span className={`badge ${status}`}>{status}</span>
                      )}
                    </td>
                    <td>
                      {due > 0 && (
                        <button type="button" className="pay-btn" onClick={() => { setPayFormRelease(false); setPayFormGst(0); setPayFormId(inv.id) }}>
                          Record payment
                        </button>
                      )}
                      {gstHeldAmt > 0 && (
                        <button
                          type="button"
                          className="pay-btn"
                          title="The client has released the held GST"
                          onClick={() => {
                            setPayFormRelease(false)
                            setPayFormGst(gstHeldAmt)
                            setPayFormId(inv.id)
                          }}
                        >
                          GST received
                        </button>
                      )}
                      {inv.status === 'sent' && (inv.gst_on_hold || Number(inv.gst_pct) > 0) && (
                        <button type="button" className="pay-btn" title="Track the GSTR-3B filing and proof for this invoice's GST" onClick={() => setGstFormId(gstFormId === inv.id ? null : inv.id)}>
                          GST release
                        </button>
                      )}
                      {held > 0 && (
                        <button type="button" className="pay-btn" onClick={() => { setPayFormRelease(true); setPayFormGst(0); setPayFormId(inv.id) }}>
                          Release retention
                        </button>
                      )}
                      {nextInvoice && (
                        <button
                          type="button"
                          className="pay-btn"
                          disabled={movePaymentExcess.isPending}
                          title={`Move the extra to ${nextInvoice.invoice_number ?? nextInvoice.display_id ?? 'the next invoice'}`}
                          onClick={() => adjustExtraToNext(inv, extra, nextInvoice)}
                        >
                          Adjust to next invoice
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <>
                          <button type="button" className="pay-btn" title="Download the tax invoice as a PDF" onClick={() => downloadDocument(inv)}>
                            Invoice PDF
                          </button>
                          <button type="button" className="pay-btn" title="Reduce the invoice (GST credit note)" onClick={() => setNoteForm({ invoiceId: inv.id, type: 'credit' })}>
                            Credit note
                          </button>
                          <button type="button" className="pay-btn" title="Increase the invoice (GST debit note)" onClick={() => setNoteForm({ invoiceId: inv.id, type: 'debit' })}>
                            Debit note
                          </button>
                        </>
                      )}
                      {(inv.status === 'draft' || isAdmin) && (
                        <button
                          type="button"
                          className="pay-btn"
                          title={inv.status === 'sent' ? 'Correct the invoice itself — for a typing error. Once the client has it, use a credit or debit note.' : undefined}
                          onClick={() => onEdit(inv)}
                        >
                          {inv.status === 'sent' ? 'Correct' : 'Edit'}
                        </button>
                      )}
                      <button type="button" className="btn danger-link" onClick={() => deleteInvoice.mutate(inv.id)}>
                        Remove
                      </button>
                      {(notes ?? []).filter((n) => n.invoice_id === inv.id).length > 0 && (
                        <div className="pay-history">
                          {(notes ?? [])
                            .filter((n) => n.invoice_id === inv.id)
                            .map((n) => (
                              <div key={n.id}>
                                {n.display_id} — {fmtDate(n.date)} — {n.note_type === 'credit' ? '−' : '+'}
                                {fmt(Number(n.amount) + Number(n.gst_amount))} · {n.reason}{' '}
                                <button type="button" className="btn link" onClick={() => downloadDocument(inv, n)}>
                                  PDF
                                </button>{' '}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn link"
                                    onClick={async () => {
                                      const ok = await confirmAction({
                                        title: 'Remove note',
                                        message: `Remove ${n.display_id}? This takes it out of the invoice and the ledger.`,
                                        confirmLabel: 'Remove',
                                        danger: true,
                                      })
                                      if (ok) deleteNote.mutate(n.id)
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                      {hasHistory && (
                        <div className="pay-history">
                          {invPayments.map((p) =>
                            editingPaymentId === p.id ? (
                              <EditInvoicePaymentFields key={p.id} payment={p} hasRetention={!!inv.retention_pct} gstOnHold={!!inv.gst_on_hold} onClose={() => setEditingPaymentId(null)} />
                            ) : (
                              <div key={p.id}>
                                {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
                                {p.reference ? ` · ${p.reference}` : ''}
                                {p.is_retention_release ? ' · retention release' : ''}
                                {Number(p.gst_component) > 0 ? ` · incl. GST ${fmt(p.gst_component)}` : ''}
                                {(() => {
                                  const parts = p.receipt_id ? (payments ?? []).filter((q) => q.receipt_id === p.receipt_id) : []
                                  return parts.length > 1
                                    ? ` · part of a ${fmt(parts.reduce((sum, q) => sum + Number(q.amount || 0), 0))} receipt`
                                    : ''
                                })()}{' '}
                                <button type="button" className="btn link" onClick={() => setEditingPaymentId(p.id)}>
                                  Edit
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {noteForm?.invoiceId === inv.id && (
                    <InvoiceNoteForm invoice={inv} type={noteForm.type} onClose={() => setNoteForm(null)} />
                  )}
                  {payFormId === inv.id && (
                    <InvoicePaymentForm
                      invoiceId={inv.id}
                      due={payFormRelease ? held : payFormGst > 0 ? payFormGst : due}
                      retentionRelease={payFormRelease}
                      gstOnHold={!!inv.gst_on_hold}
                      gstRelease={payFormGst > 0 ? payFormGst : undefined}
                      onClose={() => setPayFormId(null)}
                    />
                  )}
                  {gstFormId === inv.id && (
                    <GstReleaseForm invoice={inv} onClose={() => setGstFormId(null)} />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
