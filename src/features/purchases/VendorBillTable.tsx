import { Fragment, useEffect, useState } from 'react'
import { useNavFilter } from '../../lib/navContext'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBill, useVendorBillItems } from '../../lib/queries/purchases'
import { itemsSummary } from '../../lib/calc/billItems'
import { useVendors, useProjects, useClients, useExpenseSubHeads } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { billGstAmt, billTdsAmt, billTotal, billPaid, billDue, billDueRaw } from '../../lib/calc/vendorBills'
import type { DateRange } from '../../lib/calc/period'
import { VendorBillPaymentForm } from './VendorBillPaymentForm'
import { ReceiptLink } from '../../components/ReceiptLink'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'
import { VendorBillForm } from './VendorBillForm'
import { confirmAction } from '../../lib/feedback'
import { clientLabel, clientFullName } from '../../lib/labels'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']
type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

export function VendorBillTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: bills, isLoading } = useVendorBills(range)
  const { data: payments } = useVendorBillPayments()
  const { data: vendors } = useVendors()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: billItems } = useVendorBillItems()
  const deleteBill = useDeleteVendorBill()
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const openRows = useOpenRows()
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null)
  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)
  const [editListId, setEditListId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState('')
  const [search, setSearch] = useState('')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const nav = useNavFilter('purchases')
  useEffect(() => {
    if (nav) setUnpaidOnly(nav.filter.vendorView === 'unpaid')
  }, [nav])

  async function removeBill(b: VendorBill) {
    const ok = await confirmAction({
      title: 'Delete vendor bill',
      message: `Delete bill ${b.display_id ?? ''}? Its payments go with it. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteBill.mutate(b.id)
  }

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
  const vendorFiltered = vendorFilter ? categoryFiltered?.filter((b) => b.vendor_id === vendorFilter) : categoryFiltered

  const vendorNameOf = (b: NonNullable<typeof bills>[number]) => vendors?.find((v) => v.id === b.vendor_id)?.name ?? ''
  const subHeadNameOf = (b: NonNullable<typeof bills>[number]) => subHeads?.find((s) => s.id === b.sub_head_id)?.name ?? ''
  const clientNameOf = (b: NonNullable<typeof bills>[number]) => {
    const client = b.client_id ? clients?.find((c) => c.id === b.client_id) : null
    return clientLabel(client)
  }
  const clientFullNameOf = (b: NonNullable<typeof bills>[number]) => {
    const client = b.client_id ? clients?.find((c) => c.id === b.client_id) : null
    return clientFullName(client)
  }
  const projectNameOf = (b: NonNullable<typeof bills>[number]) => {
    const project = b.project_id ? projects?.find((p) => p.id === b.project_id) : null
    return project?.name ?? ''
  }
  const itemsOf = (b: NonNullable<typeof bills>[number]) => (billItems ?? []).filter((i) => i.bill_id === b.id)
  const paidOf = (b: NonNullable<typeof bills>[number]) => billPaid(payments?.filter((p) => p.bill_id === b.id) ?? [])
  // Raw (unclamped) — a negative value here means this bill is overpaid, a
  // credit that should offset another underpaid bill for the same vendor
  // rather than silently vanishing. See VendorPage for the net.
  const dueOf = (b: NonNullable<typeof bills>[number]) => billDueRaw(b, payments?.filter((p) => p.bill_id === b.id) ?? [])

  // Only bills that still have something to pay (a bill paid in full, or
  // overpaid, is left out).
  const visibleBills = unpaidOnly ? vendorFiltered?.filter((b) => dueOf(b) > 0.01) : vendorFiltered

  const searchedBills = search
    ? visibleBills?.filter((b) =>
        matchesSearch(search, [b.display_id, b.description, b.remarks, b.vendor_invoice_no, b.date, b.amount, billTotal(b), vendorNameOf(b), clientNameOf(b), projectNameOf(b), ...itemsOf(b).map((i) => i.name)])
      )
    : visibleBills

  const { sorted: sortedBills, sortKey, direction, toggleSort } = useSort(
    searchedBills,
    {
      id: (b) => b.display_id,
      vendor: (b) => vendorNameOf(b),
      description: (b) => b.description,
      client: (b) => clientNameOf(b),
      project: (b) => projectNameOf(b),
      date: (b) => b.date,
      amount: (b) => b.amount,
      gst: (b) => billGstAmt(b),
      tds: (b) => billTdsAmt(b),
      total: (b) => billTotal(b),
      paid: (b) => paidOf(b),
      due: (b) => dueOf(b),
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedBills, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Bill records',
      columns: ['Ref ID', 'Vendor', 'Description', 'Sub-head', 'Remarks', 'Client', 'Project', 'Date', 'Qty', 'Rate', 'Other cost', 'Amount', 'GST', 'TDS', 'Total', 'Paid', 'Due', 'Items'],
      rows: (sortedBills ?? []).map((b) => [
        b.display_id ?? '',
        vendorNameOf(b),
        b.description ?? '',
        subHeadNameOf(b),
        b.remarks ?? '',
        clientFullNameOf(b),
        projectNameOf(b),
        b.date ? fmtDate(b.date) : '',
        b.qty ?? '',
        b.rate ?? '',
        b.other_cost ?? '',
        b.amount,
        billGstAmt(b),
        billTdsAmt(b),
        billTotal(b),
        paidOf(b),
        dueOf(b),
        itemsSummary(itemsOf(b)),
      ]),
    },
  ]

  return (
    <details className="toggle-section" open id="bill-records">
      <summary>Bill records</summary>

      <div className="toolbar">
        <div className="toolbar-group">
          <PeriodFilter
            onChange={setRange}
            allowCustom
            style={{ marginBottom: 0 }}
            preset={nav?.filter.range ? { ...nav.filter.range, nonce: nav.nonce } : undefined}
          />
          <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
            <label>Search vendor</label>
            <SearchableSelect
              items={vendors}
              value={vendorFilter}
              onChange={setVendorFilter}
              getId={(v) => v.id}
              getLabel={(v) => v.name}
              getSearchValue={(v) => `${v.name} ${v.phone ?? ''}`}
              placeholder="— All vendors —"
            />
          </div>
          <label className="check-inline" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} />
            Unpaid only
          </label>
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

      <TableSearch value={search} onChange={setSearch} />
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <SortableTh label="Ref ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Total" sortKey="total" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Paid" sortKey="paid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Due" sortKey="due" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedBills || sortedBills.length === 0) && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No vendor bills in this period
                </td>
              </tr>
            )}
            {pageRows?.map((b) => {
              const vendor = vendors?.find((v) => v.id === b.vendor_id)
              const billPayments = payments?.filter((p) => p.bill_id === b.id) ?? []
              const paid = billPaid(billPayments)
              const due = billDue(b, billPayments)
              const rawDue = billDueRaw(b, billPayments)
              const hasHistory = billPayments.length > 0
              const showEditList = editListId === b.id
              const billItemRows = itemsOf(b)

              return (
                <Fragment key={b.id}>
                  <RecordRow
                    expanded={openRows.isOpen(b.id)}
                    onToggle={() => openRows.toggle(b.id)}
                    colSpan={9}
                    details={
                      <>
                        <RecordDetails sourceTable="vendor_bills" sourceId={b.id} />
                        {b.receipt_path && (
                          <div style={{ marginTop: 10 }}>
                            Receipt: <ReceiptLink path={b.receipt_path} />
                          </div>
                        )}
                        {hasHistory && (
                          <div className="pay-history" style={{ marginTop: 10 }}>
                            <strong>Payments</strong>
                            {billPayments.map((p) => (
                              <div key={p.id} className="pay-history-line">
                                <span>
                                  {p.display_id} — {fmtDate(p.date)} — {fmt(p.amount)}
                                  {p.payment_mode ? ` · ${p.payment_mode === 'Advance' ? 'from advance' : p.payment_mode}` : ''}
                                  {p.reference ? ` · ${p.reference}` : ''}
                                </span>
                                {showEditList && p.payment_mode !== 'Advance' && (
                                  <button type="button" className="pay-history-edit" onClick={() => openEditPayment(b.id, p)}>
                                    Edit
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    }
                    extraItems={[
                      { label: 'Add payment', disabled: due <= 0, onClick: () => openAddPayment(b.id) },
                      {
                        label: 'Edit payments',
                        disabled: !hasHistory,
                        onClick: () => {
                          setEditListId(b.id)
                          openRows.open(b.id)
                        },
                      },
                    ]}
                    onEdit={() => setEditingBill(b)}
                    onDelete={() => void removeBill(b)}
                  >
                    <td>{b.display_id ?? '—'}</td>
                    <td>{vendor ? vendor.name : '—'}</td>
                    <td>
                      {b.description ?? '—'}
                      {billItemRows.length > 0 && <div className="retention-note">{billItemRows.length} item{billItemRows.length === 1 ? '' : 's'}</div>}
                    </td>
                    <td>{b.date ? fmtDate(b.date) : '—'}</td>
                    <td className="amt">{fmt(billTotal(b))}</td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{fmt(rawDue)}</td>
                  </RecordRow>
                  {payFormId === b.id && (
                    <VendorBillPaymentForm billId={b.id} due={due} editingPayment={editingPayment} colSpan={9} onClose={closePayForm} />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editingBill && (
        <Modal title={`Edit vendor bill ${editingBill.display_id ?? ''}`} onClose={() => setEditingBill(null)}>
          <VendorBillForm editingBill={editingBill} onDoneEditing={() => setEditingBill(null)} inModal />
        </Modal>
      )}
    </details>
  )
}
