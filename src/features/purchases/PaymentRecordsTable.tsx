import { Fragment, useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
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

  const [vendorId, setVendorId] = useState('')
  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)

  const billOf = (p: VendorBillPayment) => bills?.find((b) => b.id === p.bill_id)
  const vendorOf = (p: VendorBillPayment) => {
    const bill = billOf(p)
    return bill ? vendors?.find((v) => v.id === bill.vendor_id) : undefined
  }

  const vendorFiltered = vendorId ? (payments ?? []).filter((p) => vendorOf(p)?.id === vendorId) : payments

  const { sorted: sortedPayments, sortKey, direction, toggleSort } = useSort(
    vendorFiltered,
    {
      id: (p) => p.display_id,
      date: (p) => p.date,
      vendor: (p) => vendorOf(p)?.name ?? '',
      bill: (p) => billOf(p)?.display_id ?? '',
      amount: (p) => p.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedPayments)

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
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
        <ReportExportButtons title="Payment records" sections={exportSections} range={null} style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
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
                <td colSpan={8} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedPayments || sortedPayments.length === 0) && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No payments recorded
                </td>
              </tr>
            )}
            {pageRows?.map((p) => {
              const bill = billOf(p)
              const vendor = vendorOf(p)
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.display_id ?? '—'}</td>
                    <td>{fmtDate(p.date)}</td>
                    <td>{vendor?.name ?? '—'}</td>
                    <td>{bill?.display_id ?? '—'}</td>
                    <td className="amt">{fmt(p.amount)}</td>
                    <td>{p.reference ?? '—'}</td>
                    <td>{p.payment_mode ?? '—'}</td>
                    <td>
                      <RowMenu
                        items={[
                          { label: 'Edit', onClick: () => setEditingPayment(p) },
                          { label: 'Remove', onClick: () => deletePayment.mutate(p.id) },
                        ]}
                      />
                    </td>
                  </tr>
                  {editingPayment?.id === p.id && bill && (
                    <VendorBillPaymentForm
                      billId={bill.id}
                      due={0}
                      editingPayment={editingPayment}
                      colSpan={8}
                      onClose={() => setEditingPayment(null)}
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
