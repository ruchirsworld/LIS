import { Fragment, useState } from 'react'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBillPayment } from '../../lib/queries/purchases'
import { fmt, fmtDate } from '../../lib/calc/format'
import { VendorBillPaymentForm } from '../purchases/VendorBillPaymentForm'
import type { Database } from '../../types/database'

type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

/** Payment records for a single, already-selected vendor — same shape as
 * Procurements' PaymentRecordsTable, minus the vendor column/filter since
 * that's fixed by the page. */
export function VendorPaymentRecordsTable({ vendorId }: { vendorId: string }) {
  const { data: bills } = useVendorBills(null)
  const { data: allPayments, isLoading } = useVendorBillPayments()
  const deletePayment = useDeleteVendorBillPayment()

  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)

  const vendorBillIds = new Set((bills ?? []).filter((b) => b.vendor_id === vendorId).map((b) => b.id))
  const payments = (allPayments ?? []).filter((p) => vendorBillIds.has(p.bill_id))
  const billOf = (p: VendorBillPayment) => bills?.find((b) => b.id === p.bill_id)

  const { sorted: sortedPayments, sortKey, direction, toggleSort } = useSort(
    payments,
    {
      id: (p) => p.display_id,
      date: (p) => p.date,
      bill: (p) => billOf(p)?.display_id ?? '',
      amount: (p) => p.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedPayments)

  const exportSections: ExportSection[] = [
    {
      title: 'Payment records',
      columns: ['ID', 'Date', 'Against bill', 'Amount', 'Reference', 'Payment mode'],
      rows: (sortedPayments ?? []).map((p) => [
        p.display_id ?? '',
        fmtDate(p.date),
        billOf(p)?.display_id ?? '',
        p.amount,
        p.reference ?? '',
        p.payment_mode ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Records of the payments</summary>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <ReportExportButtons title="Payment records" sections={exportSections} range={null} style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
                <td colSpan={7} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedPayments || sortedPayments.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No payments recorded for this vendor
                </td>
              </tr>
            )}
            {pageRows?.map((p) => {
              const bill = billOf(p)
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.display_id ?? '—'}</td>
                    <td>{fmtDate(p.date)}</td>
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
                      colSpan={7}
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
