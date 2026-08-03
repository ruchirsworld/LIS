import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
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
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']
type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

export function VendorBillTable({ onEdit }: { onEdit: (bill: VendorBill) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: bills, isLoading } = useVendorBills(range)
  const { data: payments } = useVendorBillPayments()
  const { data: vendors } = useVendors()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const deleteBill = useDeleteVendorBill()
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)
  const [editListId, setEditListId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState('')

  function closePayForm() {
    setPayFormId(null)
    setEditingPayment(null)
  }

  function openAddPayment(billId: string) {
    setEditingPayment(null)
    setPayFormId(billId)
  }

  function openEditPayment(billId: string, payment: VendorBillPayment) {
    setEditingPayment(payment)
    setPayFormId(billId)
  }

  const categories = Array.from(new Set(vendors?.map((v) => v.category).filter((c): c is string => !!c))).sort()
  const categoryFiltered = categoryFilter
    ? bills?.filter((b) => vendors?.find((v) => v.id === b.vendor_id)?.category === categoryFilter)
    : bills
  const visibleBills = vendorFilter ? categoryFiltered?.filter((b) => b.vendor_id === vendorFilter) : categoryFiltered

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
      title: 'Bill records',
      columns: ['Ref ID', 'Vendor', 'Description', 'Remarks', 'Client', 'Project', 'Date', 'Qty', 'Rate', 'Amount', 'GST', 'Total', 'Paid', 'Due'],
      rows: (sortedBills ?? []).map((b) => [
        b.display_id ?? '',
        vendorNameOf(b),
        b.description ?? '',
        b.remarks ?? '',
        clientNameOf(b),
        projectNameOf(b),
        b.date ? fmtDate(b.date) : '',
        b.qty ?? '',
        b.rate ?? '',
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
      <summary>Bill records</summary>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
          <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
            <label>Search vendor</label>
            <SearchableSelect
              items={vendors}
              value={vendorFilter}
              onChange={setVendorFilter}
              getId={(v) => v.id}
              getLabel={(v) => v.name}
              placeholder="— All vendors —"
            />
          </div>
        </div>
        <ReportExportButtons title="Bill records" sections={exportSections} range={range} style={{ marginTop: 0 }} />
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

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="Ref ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Remarks</th>
              <SortableTh label="Client" sortKey="client" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="GST" sortKey="gst" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Total" sortKey="total" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
              <th>Receipt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={17} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedBills || sortedBills.length === 0) && (
              <tr>
                <td colSpan={17} className="empty-row">
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

              const showEditList = editListId === b.id

              return (
                <Fragment key={b.id}>
                  <tr>
                    <td>{b.display_id ?? '—'}</td>
                    <td>{vendor ? vendor.name : '—'}</td>
                    <td>{b.description ?? '—'}</td>
                    <td>{b.remarks ?? '—'}</td>
                    <td>{clientLabel(client)}</td>
                    <td>{project ? project.name : '—'}</td>
                    <td>{b.date ? fmtDate(b.date) : '—'}</td>
                    <td className="amt">{b.qty ?? '—'}</td>
                    <td className="amt">{b.rate != null ? fmt(b.rate) : '—'}</td>
                    <td className="amt">{fmt(b.amount)}</td>
                    <td className="amt">{fmt(billGstAmt(b))}</td>
                    <td className="amt">{fmt(billTotal(b))}</td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{fmt(due)}</td>
                    <td>
                      <RowMenu
                        items={[
                          { label: 'Add payment', disabled: due <= 0, onClick: () => openAddPayment(b.id) },
                          { label: 'Edit payments', disabled: !hasHistory, onClick: () => setEditListId(b.id) },
                        ]}
                      />
                    </td>
                    <td>{b.receipt_path ? <ReceiptLink path={b.receipt_path} /> : '—'}</td>
                    <td>
                      <button type="button" className="pay-btn" onClick={() => onEdit(b)}>
                        Edit
                      </button>
                      <button type="button" className="btn danger-link" onClick={() => deleteBill.mutate(b.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {billPayments.map((p) => (
                            <div key={p.id} className="pay-history-line">
                              <span>
                                {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
                                {p.payment_mode ? ` · ${p.payment_mode}` : ''}
                                {p.reference ? ` · ${p.reference}` : ''}
                              </span>
                              {showEditList && (
                                <button
                                  type="button"
                                  className="pay-history-edit"
                                  onClick={() => openEditPayment(b.id, p)}
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {payFormId === b.id && (
                    <VendorBillPaymentForm
                      billId={b.id}
                      due={due}
                      editingPayment={editingPayment}
                      colSpan={17}
                      onClose={closePayForm}
                    />
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
