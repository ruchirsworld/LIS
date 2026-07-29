import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBill } from '../../lib/queries/purchases'
import { useVendors, useProjects, useClients } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
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

  const vendorNameOf = (b: NonNullable<typeof bills>[number]) => vendors?.find((v) => v.id === b.vendor_id)?.name ?? ''
  const clientNameOf = (b: NonNullable<typeof bills>[number]) => {
    const client = b.client_id ? clients?.find((c) => c.id === b.client_id) : null
    return clientLabel(client)
  }
  const projectNameOf = (b: NonNullable<typeof bills>[number]) => {
    const project = b.project_id ? projects?.find((p) => p.id === b.project_id) : null
    return project?.name ?? ''
  }
  const paidOf = (b: NonNullable<typeof bills>[number]) => billPaid(payments?.filter((p) => p.bill_id === b.id) ?? [])
  const dueOf = (b: NonNullable<typeof bills>[number]) => billDue(b, payments?.filter((p) => p.bill_id === b.id) ?? [])

  const { sorted: sortedBills, sortKey, direction, toggleSort } = useSort(
    visibleBills,
    {
      id: (b) => b.display_id,
      vendor: (b) => vendorNameOf(b),
      description: (b) => b.description,
      client: (b) => clientNameOf(b),
      project: (b) => projectNameOf(b),
      date: (b) => b.date,
      amount: (b) => b.amount,
      gst: (b) => billGstAmt(b),
      total: (b) => billTotal(b),
      paid: (b) => paidOf(b),
      due: (b) => dueOf(b),
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedBills)

  const exportSections: ExportSection[] = [
    {
      title: 'Vendor bill records',
      columns: ['Ref ID', 'Vendor', 'Description', 'Client', 'Project', 'Date', 'Amount', 'GST', 'Total', 'Paid', 'Due'],
      rows: (sortedBills ?? []).map((b) => [
        b.display_id ?? '',
        vendorNameOf(b),
        b.description ?? '',
        clientNameOf(b),
        projectNameOf(b),
        b.date ? fmtDate(b.date) : '',
        b.amount,
        billGstAmt(b),
        billTotal(b),
        paidOf(b),
        dueOf(b),
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Vendor bill records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} allowCustom />
      </div>

      <ReportExportButtons title="Vendor bill records" sections={exportSections} range={range} />

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
              <SortableTh label="Ref ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client" sortKey="client" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="GST" sortKey="gst" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Total" sortKey="total" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
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
            {!isLoading && (!sortedBills || sortedBills.length === 0) && (
              <tr>
                <td colSpan={13} className="empty-row">
                  No vendor bills in this period
                </td>
              </tr>
            )}
            {pageRows?.map((b) => {
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
                    <td>{b.date ? fmtDate(b.date) : '—'}</td>
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
                              {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
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
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
