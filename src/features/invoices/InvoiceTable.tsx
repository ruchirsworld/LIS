import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useInvoices, useInvoicePayments, useDeleteInvoice, useCycleInvoiceStatus } from '../../lib/queries/invoices'
import { useClients, useProjects } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import { gstAmt, tdsAmt, netPayable, totalPaid, dueAmount, effectiveDueDate, effectiveStatus } from '../../lib/calc/invoices'
import type { DateRange } from '../../lib/calc/period'
import { InvoicePaymentForm } from './InvoicePaymentForm'
import { clientLabel } from '../../lib/labels'

export function InvoiceTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: invoices, isLoading } = useInvoices(range)
  const { data: payments } = useInvoicePayments()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const deleteInvoice = useDeleteInvoice()
  const cycleStatus = useCycleInvoiceStatus()
  const [payFormId, setPayFormId] = useState<string | null>(null)

  return (
    <details className="toggle-section" open>
      <summary>Invoice records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Invoice no.</th>
              <th>Client</th>
              <th>Project</th>
              <th>Invoice date</th>
              <th>Due date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>GST</th>
              <th style={{ textAlign: 'right' }}>TDS</th>
              <th style={{ textAlign: 'right' }}>Net payable</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              <th>Status</th>
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
            {!isLoading && (!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={14} className="empty-row">
                  No invoices in this period
                </td>
              </tr>
            )}
            {invoices?.map((inv) => {
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
                    <td>{inv.invoice_date ?? '— (not sent yet)'}</td>
                    <td>{dueDateDisplay ?? '—'}</td>
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
                      <button type="button" className="btn danger-link" onClick={() => deleteInvoice.mutate(inv.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {invPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {p.date} — {fmt(p.amount)}
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
    </details>
  )
}
