import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useInvoices, useInvoicePayments, useDeleteInvoice, useCycleInvoiceStatus, useMovePaymentExcess } from '../../lib/queries/invoices'
import { useClients, useProjects } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { gstAmt, tdsAmt, netPayable, retentionAmt, totalPaid, dueAmount, extraPaid, effectiveDueDate, effectiveStatus } from '../../lib/calc/invoices'
import type { DateRange } from '../../lib/calc/period'
import { InvoicePaymentForm, EditInvoicePaymentFields } from './InvoicePaymentForm'
import { clientLabel, clientFullName, clientGstLine } from '../../lib/labels'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']
type Client = Database['public']['Tables']['clients']['Row']

/** Formats a running balance the way a Tally-style ledger does: the figure plus Dr/Cr side. */
function fmtBalance(balance: number): string {
  return `${fmt(Math.abs(balance))} ${balance >= 0 ? 'Dr' : 'Cr'}`
}

/**
 * Builds one ledger section per client — Tally-style: opening balance carried in from
 * before the selected period, then a chronological Date/Particulars/Vch No./Debit/Credit/
 * Balance trail (invoices debit the client, payments credit them), ending in a closing
 * balance. This is what Excel/PDF export renders; the on-screen table stays a flat grid
 * since it needs per-row action buttons (edit/pay/remove) a ledger layout has no room for.
 */
function buildLedgerSections(
  clients: Client[] | undefined,
  allInvoices: Invoice[] | undefined,
  allPayments: InvoicePayment[] | undefined,
  range: DateRange | null,
  clientFilter: string
): ExportSection[] {
  type Entry = { date: string; particulars: string; vch: string; debit: number; credit: number }

  const relevantClients = (clients ?? [])
    .filter((c) => !clientFilter || c.id === clientFilter)
    .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)))

  const sections: ExportSection[] = []

  for (const client of relevantClients) {
    const clientInvoices = (allInvoices ?? []).filter((inv) => inv.client_id === client.id && inv.invoice_date)
    const invoiceIds = new Set(clientInvoices.map((inv) => inv.id))
    const clientPayments = (allPayments ?? []).filter((p) => invoiceIds.has(p.invoice_id))

    if (clientInvoices.length === 0 && clientPayments.length === 0) continue

    const before: Entry[] = []
    const within: Entry[] = []

    const bucket = (entry: Entry) => {
      if (range?.from && entry.date < range.from) before.push(entry)
      else if (!range?.to || entry.date <= range.to) within.push(entry)
    }

    for (const inv of clientInvoices) {
      bucket({
        date: inv.invoice_date as string,
        particulars: `Invoice ${inv.invoice_number ?? inv.display_id ?? ''}`.trim(),
        vch: inv.invoice_number ?? inv.display_id ?? '',
        debit: netPayable(inv),
        credit: 0,
      })
    }
    for (const p of clientPayments) {
      bucket({
        date: p.date,
        particulars: `Payment received${p.reference ? ' — ' + p.reference : ''}`,
        vch: p.display_id ?? '',
        debit: 0,
        credit: Number(p.amount || 0),
      })
    }

    within.sort((a, b) => a.date.localeCompare(b.date))
    const openingBalance = before.reduce((bal, e) => bal + e.debit - e.credit, 0)

    let running = openingBalance
    const rows: (string | number)[][] = [['', 'Opening balance', '', '', '', fmtBalance(running)]]
    for (const e of within) {
      running += e.debit - e.credit
      rows.push([
        fmtDate(e.date),
        e.particulars,
        e.vch,
        e.debit ? fmt(e.debit) : '',
        e.credit ? fmt(e.credit) : '',
        fmtBalance(running),
      ])
    }
    rows.push(['', 'Closing balance', '', '', '', fmtBalance(running)])

    sections.push({
      title: clientFullName(client),
      columns: ['Date', 'Particulars', 'Vch No.', 'Debit', 'Credit', 'Balance'],
      rows,
    })
  }

  return sections
}

export function InvoiceTable({ onEdit }: { onEdit: (invoice: Invoice) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const { data: invoices, isLoading } = useInvoices(range)
  const { data: allInvoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const deleteInvoice = useDeleteInvoice()
  const cycleStatus = useCycleInvoiceStatus()
  const movePaymentExcess = useMovePaymentExcess()
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [payFormId, setPayFormId] = useState<string | null>(null)
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
        payments: payments?.filter((p) => p.invoice_id === inv.id) ?? [],
        amount: Math.min(extra, dueOf(target)),
        targetInvoiceId: target.id,
        fromLabel: inv.invoice_number ?? inv.display_id ?? 'earlier invoice',
      })
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Could not adjust the extra payment.')
    }
  }

  const filteredInvoices = clientFilter ? invoices?.filter((inv) => inv.client_id === clientFilter) : invoices

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

  const exportSections = buildLedgerSections(clients, allInvoices, payments, range, clientFilter)
  // When narrowed to one client, the export should say so up front — full
  // name and GST in the document, client code in the downloaded filename —
  // rather than leaving the header as the generic "Ledger" title with no
  // per-section title (which only prints when there's more than one).
  const filterClient = clientFilter ? clients?.find((c) => c.id === clientFilter) : undefined
  const ledgerTitle = filterClient ? `${clientFullName(filterClient)} ledger` : 'Ledger'
  const ledgerGst = filterClient ? clientGstLine(filterClient) : undefined
  const ledgerFileNamePrefix = filterClient ? `${clientLabel(filterClient)}_Ledger` : 'Ledger'

  return (
    <details className="toggle-section" open>
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
        </div>
        <ReportExportButtons
          title={ledgerTitle}
          sections={exportSections}
          range={range}
          style={{ marginTop: 0 }}
          headerNote={ledgerGst ?? undefined}
          fileNamePrefix={ledgerFileNamePrefix}
        />
      </div>

      {adjustError && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {adjustError}
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
                    <td className="amt">{fmt(inv.amount)}</td>
                    <td className="amt">
                      {fmt(gstAmt(inv))} <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>({inv.gst_pct || 0}%)</span>
                    </td>
                    <td className="amt">
                      {fmt(tdsAmt(inv))} <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>({inv.tds_pct || 0}%)</span>
                    </td>
                    <td className="amt">{fmt(netPayable(inv))}</td>
                    <td className="amt">
                      {inv.retention_pct ? (
                        <>
                          {fmt(retentionAmt(inv))} <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>({inv.retention_pct}%)</span>
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
                        <button type="button" className="pay-btn" onClick={() => setPayFormId(inv.id)}>
                          Record payment
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
                      <button type="button" className="pay-btn" onClick={() => onEdit(inv)}>
                        {inv.status === 'sent' ? 'Adjust' : 'Edit'}
                      </button>
                      <button type="button" className="btn danger-link" onClick={() => deleteInvoice.mutate(inv.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {invPayments.map((p) =>
                            editingPaymentId === p.id ? (
                              <EditInvoicePaymentFields key={p.id} payment={p} onClose={() => setEditingPaymentId(null)} />
                            ) : (
                              <div key={p.id}>
                                {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
                                {p.reference ? ` · ${p.reference}` : ''}{' '}
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
                  {payFormId === inv.id && (
                    <InvoicePaymentForm invoiceId={inv.id} due={due} onClose={() => setPayFormId(null)} />
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
