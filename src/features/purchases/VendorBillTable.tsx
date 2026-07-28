import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBill } from '../../lib/queries/purchases'
import { useVendors, useProjects, useClients } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import { billGstAmt, billTotal, billPaid, billDue } from '../../lib/calc/vendorBills'
import type { DateRange } from '../../lib/calc/period'
import { VendorBillPaymentForm } from './VendorBillPaymentForm'
import { ReceiptLink } from '../../components/ReceiptLink'
import { clientLabel } from '../../lib/labels'

export function VendorBillTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: bills, isLoading } = useVendorBills(range)
  const { data: payments } = useVendorBillPayments()
  const { data: vendors } = useVendors()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const deleteBill = useDeleteVendorBill()
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const categories = Array.from(new Set(vendors?.map((v) => v.category).filter((c): c is string => !!c))).sort()
  const visibleBills = categoryFilter
    ? bills?.filter((b) => vendors?.find((v) => v.id === b.vendor_id)?.category === categoryFilter)
    : bills

  return (
    <details className="toggle-section" open>
      <summary>Vendor bill records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      {categories.length > 0 && (
        <div className="pill-tabs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className={categoryFilter === null ? 'pill active' : 'pill'} onClick={() => setCategoryFilter(null)}>
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={categoryFilter === cat ? 'pill active' : 'pill'}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Ref ID</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Client</th>
              <th>Project</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>GST</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              <th>Receipt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={13} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!visibleBills || visibleBills.length === 0) && (
              <tr>
                <td colSpan={13} className="empty-row">
                  No vendor bills in this period
                </td>
              </tr>
            )}
            {visibleBills?.map((b) => {
              const vendor = vendors?.find((v) => v.id === b.vendor_id)
              const client = b.client_id ? clients?.find((c) => c.id === b.client_id) : null
              const project = b.project_id ? projects?.find((p) => p.id === b.project_id) : null
              const billPayments = payments?.filter((p) => p.bill_id === b.id) ?? []
              const paid = billPaid(billPayments)
              const due = billDue(b, billPayments)
              const hasHistory = billPayments.length > 0

              return (
                <Fragment key={b.id}>
                  <tr>
                    <td>{b.display_id ?? '—'}</td>
                    <td>{vendor ? vendor.name : '—'}</td>
                    <td>{b.description ?? '—'}</td>
                    <td>{clientLabel(client)}</td>
                    <td>{project ? project.name : '—'}</td>
                    <td>{b.date ?? '—'}</td>
                    <td className="amt">{fmt(b.amount)}</td>
                    <td className="amt">{fmt(billGstAmt(b))}</td>
                    <td className="amt">{fmt(billTotal(b))}</td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{fmt(due)}</td>
                    <td>{b.receipt_path ? <ReceiptLink path={b.receipt_path} /> : '—'}</td>
                    <td>
                      {due > 0 && (
                        <button type="button" className="pay-btn" onClick={() => setPayFormId(b.id)}>
                          Record payment
                        </button>
                      )}
                      <button type="button" className="btn danger-link" onClick={() => deleteBill.mutate(b.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {billPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {p.date} — {fmt(p.amount)}
                              {p.payment_mode ? ` · ${p.payment_mode}` : ''}
                              {p.reference ? ` · ${p.reference}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {payFormId === b.id && (
                    <VendorBillPaymentForm billId={b.id} due={due} onClose={() => setPayFormId(null)} />
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
