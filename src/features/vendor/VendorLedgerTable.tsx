import { Fragment, useMemo, useState } from 'react'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { ReceiptLink } from '../../components/ReceiptLink'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useVendorBills, useVendorBillPayments, useDeleteVendorBillPayment } from '../../lib/queries/purchases'
import { fmt, fmtDate } from '../../lib/calc/format'
import { billTotal } from '../../lib/calc/vendorBills'
import { VendorBillPaymentForm } from '../purchases/VendorBillPaymentForm'
import type { Database } from '../../types/database'

type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

interface LedgerRow {
  key: string
  type: 'Bill' | 'Payment'
  id: string
  date: string
  details: string
  debit: number
  credit: number
  balance: number
  receiptPath: string | null
  payment: VendorBillPayment | null
}

/** Single date-wise ledger for a vendor — bills (debit) and payments
 * (credit) merged into one running-balance table, replacing the
 * payments-only records list. */
export function VendorLedgerTable({ vendorId }: { vendorId: string }) {
  const { data: bills, isLoading: billsLoading } = useVendorBills(null)
  const { data: allPayments, isLoading: paymentsLoading } = useVendorBillPayments()
  const deletePayment = useDeleteVendorBillPayment()

  const [editingPayment, setEditingPayment] = useState<VendorBillPayment | null>(null)

  const vendorBills = useMemo(() => (bills ?? []).filter((b) => b.vendor_id === vendorId), [bills, vendorId])
  const vendorBillIds = useMemo(() => new Set(vendorBills.map((b) => b.id)), [vendorBills])
  const vendorPayments = useMemo(
    () => (allPayments ?? []).filter((p) => vendorBillIds.has(p.bill_id)),
    [allPayments, vendorBillIds]
  )
  const billOf = (p: VendorBillPayment) => vendorBills.find((b) => b.id === p.bill_id)

  // Running balance only means something in true chronological order, so it's
  // computed here (oldest first) before the rows are handed to useSort, which
  // the user can then re-sort by any column without changing each row's balance.
  const ledgerRows = useMemo<LedgerRow[]>(() => {
    const entries: Omit<LedgerRow, 'balance'>[] = [
      ...vendorBills.map((b) => ({
        key: `bill-${b.id}`,
        type: 'Bill' as const,
        id: b.display_id ?? '—',
        date: b.date ?? '',
        details: b.description ?? '—',
        debit: billTotal(b),
        credit: 0,
        receiptPath: b.receipt_path,
        payment: null,
      })),
      ...vendorPayments.map((p) => {
        const bill = billOf(p)
        return {
          key: `payment-${p.id}`,
          type: 'Payment' as const,
          id: p.display_id ?? '—',
          date: p.date,
          details: `Against ${bill?.display_id ?? '—'}${p.payment_mode ? ` · ${p.payment_mode}` : ''}${p.reference ? ` · ${p.reference}` : ''}`,
          debit: 0,
          credit: Number(p.amount || 0),
          receiptPath: null,
          payment: p,
        }
      }),
    ]
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))
    let running = 0
    return entries.map((e) => {
      running += e.debit - e.credit
      return { ...e, balance: running }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorBills, vendorPayments])

  const { sorted: sortedRows, sortKey, direction, toggleSort } = useSort(
    ledgerRows,
    {
      id: (r) => r.id,
      date: (r) => r.date,
      type: (r) => r.type,
      details: (r) => r.details,
      debit: (r) => r.debit,
      credit: (r) => r.credit,
      balance: (r) => r.balance,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedRows)
  const isLoading = billsLoading || paymentsLoading

  const exportSections: ExportSection[] = [
    {
      title: 'Vendor ledger',
      columns: ['ID', 'Date', 'Type', 'Details', 'Debit', 'Credit', 'Balance'],
      rows: (sortedRows ?? []).map((r) => [r.id, fmtDate(r.date), r.type, r.details, r.debit || '', r.credit || '', r.balance]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Ledger</summary>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <ReportExportButtons title="Vendor ledger" sections={exportSections} range={null} style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Details" sortKey="details" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Debit" sortKey="debit" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Credit" sortKey="credit" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Balance" sortKey="balance" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th>Receipt</th>
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
            {!isLoading && (!sortedRows || sortedRows.length === 0) && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No bills or payments recorded for this vendor
                </td>
              </tr>
            )}
            {pageRows?.map((r) => (
              <Fragment key={r.key}>
                <tr>
                  <td>{r.id}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.type}</td>
                  <td>{r.details}</td>
                  <td className="amt">{r.debit ? fmt(r.debit) : '—'}</td>
                  <td className="amt">{r.credit ? fmt(r.credit) : '—'}</td>
                  <td className="amt">{fmt(r.balance)}</td>
                  <td>{r.receiptPath ? <ReceiptLink path={r.receiptPath} /> : '—'}</td>
                  <td>
                    {r.payment && (
                      <RowMenu
                        items={[
                          { label: 'Edit', onClick: () => setEditingPayment(r.payment) },
                          { label: 'Remove', onClick: () => deletePayment.mutate(r.payment!.id) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
                {r.payment && editingPayment?.id === r.payment.id && (
                  <VendorBillPaymentForm
                    billId={r.payment.bill_id}
                    due={0}
                    editingPayment={editingPayment}
                    colSpan={9}
                    onClose={() => setEditingPayment(null)}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
