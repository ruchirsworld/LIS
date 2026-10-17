import { Fragment, useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'
import { confirmAction } from '../../lib/feedback'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBillPayment } from '../../lib/queries/purchases'
import { useVendors } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { VendorBillPaymentForm } from './VendorBillPaymentForm'
import type { Database } from '../../types/database'

type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

export function PaymentRecordsTable() {
  const { data: payments, isLoading } = useVendorBillPayments()
  const { data: bills } = useVendorBills(null)
  const { data: vendors } = useVendors()
  const deletePayment = useDeleteVendorBillPayment()

  const openRows = useOpenRows()
  const [vendorId, setVendorId] = useState('')
  const [search, setSearch] = useState('')
  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)

  async function removePayment(p: VendorBillPayment) {
    const ok = await confirmAction({
      title: 'Delete payment',
      message: `Delete payment ${p.display_id ?? ''} of ${fmt(p.amount)} dated ${fmtDate(p.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deletePayment.mutate(p.id)
  }

  const billOf = (p: VendorBillPayment) => bills?.find((b) => b.id === p.bill_id)
  const vendorOf = (p: VendorBillPayment) => {
    const bill = billOf(p)
    return bill ? vendors?.find((v) => v.id === bill.vendor_id) : undefined
  }

  const vendorFiltered = vendorId ? (payments ?? []).filter((p) => vendorOf(p)?.id === vendorId) : payments

  const searchedPayments = search
    ? vendorFiltered?.filter((p) => matchesSearch(search, [p.display_id, p.reference, p.date, p.amount, p.payment_mode, vendorOf(p)?.name, billOf(p)?.display_id, billOf(p)?.description]))
    : vendorFiltered

  const { sorted: sortedPayments, sortKey, direction, toggleSort } = useSort(
    searchedPayments,
    {
      id: (p) => p.display_id,
      date: (p) => p.date,
      vendor: (p) => vendorOf(p)?.name ?? '',
      bill: (p) => billOf(p)?.display_id ?? '',
      amount: (p) => p.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedPayments, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Payment records',
      columns: ['ID', 'Date', 'Vendor', 'Against bill', 'Amount', 'Reference', 'Payment mode'],
      rows: (sortedPayments ?? []).map((p) => [
        p.display_id ?? '',
        fmtDate(p.date),
        vendorOf(p)?.name ?? '',
        billOf(p)?.display_id ?? '',
        p.amount,
        p.reference ?? '',
        p.payment_mode ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section">
      <summary>Payment records</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search vendor</label>
          <SearchableSelect
            items={vendors}
            value={vendorId}
            onChange={setVendorId}
            getId={(v) => v.id}
            getLabel={(v) => v.name}
            getSearchValue={(v) => `${v.name} ${v.phone ?? ''}`}
            placeholder="— All vendors —"
          />
        </div>
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Payment records" sections={exportSections} range={null} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Against bill" sortKey="bill" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th>Reference</th>
              <th>Payment mode</th>
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
            {!isLoading && (!sortedPayments || sortedPayments.length === 0) && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No payments recorded
                </td>
              </tr>
            )}
            {pageRows?.map((p) => {
              const bill = billOf(p)
              const vendor = vendorOf(p)
              return (
                <Fragment key={p.id}>
                  <RecordRow
                    expanded={openRows.isOpen(p.id)}
                    onToggle={() => openRows.toggle(p.id)}
                    colSpan={9}
                    details={<RecordDetails sourceTable="vendor_bill_payments" sourceId={p.id} />}
                    // A payment made automatically from an advance is changed through the advance or the bill, not here.
                    onEdit={p.payment_mode === 'Advance' ? undefined : () => setEditingPayment(p)}
                    onDelete={p.payment_mode === 'Advance' ? undefined : () => void removePayment(p)}
                    className={p.payment_mode === 'Reimbursement' ? 'row-reimb' : undefined}
                    title={p.payment_mode === 'Reimbursement' ? 'Recorded as reimbursement' : undefined}
                  >
                    <td>{p.display_id ?? '—'}</td>
                    <td>{fmtDate(p.date)}</td>
                    <td>{vendor?.name ?? '—'}</td>
                    <td>{bill?.display_id ?? '—'}</td>
                    <td className="amt">{fmt(p.amount)}</td>
                    <td>{p.reference ?? '—'}</td>
                    <td>
                      {p.payment_mode === 'Advance' ? (
                        <span title="Made automatically from an advance. To change it, change the advance or the bill.">From advance (automatic)</span>
                      ) : (
                        p.payment_mode ?? '—'
                      )}
                    </td>
                  </RecordRow>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editingPayment && billOf(editingPayment) && (
        <Modal title={`Edit payment ${editingPayment.display_id ?? ''}`} onClose={() => setEditingPayment(null)}>
          <table className="data">
            <tbody>
              <VendorBillPaymentForm
                billId={(billOf(editingPayment) as NonNullable<ReturnType<typeof billOf>>).id}
                due={0}
                editingPayment={editingPayment}
                colSpan={1}
                onClose={() => setEditingPayment(null)}
              />
            </tbody>
          </table>
        </Modal>
      )}
    </details>
  )
}
