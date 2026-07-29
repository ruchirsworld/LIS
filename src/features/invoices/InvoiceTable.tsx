import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useInvoices, useInvoicePayments, useDeleteInvoice, useCycleInvoiceStatus } from '../../lib/queries/invoices'
import { useClients, useProjects } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { gstAmt, tdsAmt, netPayable, totalPaid, dueAmount, effectiveDueDate, effectiveStatus } from '../../lib/calc/invoices'
import type { DateRange } from '../../lib/calc/period'
import { InvoicePaymentForm } from './InvoicePaymentForm'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

export function InvoiceTable({ onEdit }: { onEdit: (invoice: Invoice) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: invoices, isLoading } = useInvoices(range)
  const { data: payments } = useInvoicePayments()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const deleteInvoice = useDeleteInvoice()
  const cycleStatus = useCycleInvoiceStatus()
  const [payFormId, setPayFormId] = useState<string | null>(null)

  const clientNameOf = (inv: Invoice) => clientLabel(clients?.find((c) => c.id === inv.client_id))
  const projectNameOf = (inv: Invoice) => (inv.project_id ? projects?.find((p) => p.id === inv.project_id)?.name : '') ?? ''
  const paidOf = (inv: Invoice) => totalPaid(payments?.filter((p) => p.invoice_id === inv.id) ?? [])
  const dueOf = (inv: Invoice) => dueAmount(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? [])

  const { sorted: sortedInvoices, sortKey, direction, toggleSort } = useSort(
    invoices,
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
      paid: (inv) => paidOf(inv),
      due: (inv) => dueOf(inv),
      status: (inv) => effectiveStatus(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? []),
    },
    'invoiceDate'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedInvoices)

  const exportSections: ExportSection[] = [
    {
      title: 'Invoice records',
      columns: ['ID', 'Invoice no.', 'Client', 'Project', 'Invoice date', 'Due date', 'Amount', 'GST', 'TDS', 'Net payable', 'Paid', 'Due', 'Status'],
      rows: (sortedInvoices ?? []).map((inv) => {
        const invPayments = payments?.filter((p) => p.invoice_id === inv.id) ?? []
        return [
          inv.display_id ?? '',
          inv.invoice_number ?? '',
          clientNameOf(inv),
          projectNameOf(inv),
          inv.invoice_date ? fmtDate(inv.invoice_date) : '',
          (() => { const d = effectiveDueDate(inv); return d ? fmtDate(d) : '' })(),
          inv.amount,
          gstAmt(inv),
          tdsAmt(inv),
          netPayable(inv),
          totalPaid(invPayments),
          dueAmount(inv, invPayments),
          effectiveStatus(inv, invPayments),
        ]
      }),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Invoice records</summary>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
        <ReportExportButtons title="Invoice records" sections={exportSections} range={range} style={{ marginTop: 0 }} />
      </div>

      <div className="table-scroll">
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
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={14} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedInvoices || sortedInvoices.length === 0) && (
              <tr>
                <td colSpan={14} className="empty-row">
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
              const status = effectiveStatus(inv, invPayments)
              const dueDateDisplay = effectiveDueDate(inv)
              const hasHistory = invPayments.length > 0
              const canCycle = status === 'draft' || status === 'sent'

              return (
                <Fragment key={inv.id}>
                  <tr className={status === 'overdue' ? 'row-overdue' : undefined}>
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
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{fmt(due)}</td>
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
                      <button type="button" className="pay-btn" onClick={() => onEdit(inv)}>
                        Edit
                      </button>
                      <button type="button" className="btn danger-link" onClick={() => deleteInvoice.mutate(inv.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {invPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
                              {p.reference ? ` · ${p.reference}` : ''}
                            </div>
                          ))}
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
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
