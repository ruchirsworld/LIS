import { Fragment, useState } from 'react'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import {
  useExpenses,
  useExpenseReimbursements,
  useDeleteExpenseReimbursement,
  useApproveExpenseReimbursement,
} from '../../lib/queries/expenses'
import { useVendorBillPayments } from '../../lib/queries/purchases'
import { useProfiles } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ExpenseReimbursementForm } from './ExpenseReimbursementForm'
import type { Database } from '../../types/database'

type ExpenseReimbursement = Database['public']['Tables']['expense_reimbursements']['Row']

/** `costCenter` narrows the list to reimbursements against that cost center's
 * expenses, so each Expenses tab shows only its own. Payments an employee made
 * to a vendor aren't tied to a cost center and show under Admin. */
export function ReimbursementRecordsTable({ costCenter }: { costCenter?: string } = {}) {
  const { profile } = useAuth()
  const { data: reimbursements, isLoading } = useExpenseReimbursements()
  const { data: expenses } = useExpenses(null)
  const { data: vendorPayments } = useVendorBillPayments()
  const { data: profiles } = useProfiles()
  const deleteReimbursement = useDeleteExpenseReimbursement()
  const approveReimbursement = useApproveExpenseReimbursement()

  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [editingReimbursement, setEditingReimbursement] = useState<ExpenseReimbursement | null>(null)

  const expenseOf = (r: ExpenseReimbursement) => expenses?.find((e) => e.id === r.expense_id)
  const vendorPaymentOf = (r: ExpenseReimbursement) =>
    r.vendor_bill_payment_id ? vendorPayments?.find((p) => p.id === r.vendor_bill_payment_id) : undefined
  // Whoever is owed: the expense's creator, or who paid the vendor.
  const userOf = (r: ExpenseReimbursement) => {
    const ownerId = expenseOf(r)?.created_by ?? vendorPaymentOf(r)?.paid_by
    return ownerId ? profiles?.find((p) => p.id === ownerId) : undefined
  }
  const againstOf = (r: ExpenseReimbursement) => {
    const vp = vendorPaymentOf(r)
    return expenseOf(r)?.display_id ?? (vp ? `Vendor payment ${vp.display_id ?? ''}`.trim() : '')
  }
  const approverOf = (r: ExpenseReimbursement) => (r.approved_by ? profiles?.find((p) => p.id === r.approved_by) : undefined)

  const inScope = (r: ExpenseReimbursement) => {
    const expense = expenseOf(r)
    return !costCenter || (expense ? expense.cost_center === costCenter : costCenter === 'Admin')
  }
  const userFiltered = (reimbursements ?? []).filter((r) => inScope(r) && (!userId || userOf(r)?.id === userId))

  const searchedReimbursements = search
    ? userFiltered.filter((r) =>
        matchesSearch(search, [r.display_id, r.reference, r.date, r.amount, r.payment_mode, userOf(r)?.name, againstOf(r), expenseOf(r)?.description, approverOf(r)?.name])
      )
    : userFiltered

  const { sorted: sortedReimbursements, sortKey, direction, toggleSort } = useSort(
    searchedReimbursements,
    {
      id: (r) => r.display_id,
      date: (r) => r.date,
      user: (r) => userOf(r)?.name ?? '',
      expense: (r) => againstOf(r),
      amount: (r) => r.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedReimbursements, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Reimbursement records',
      columns: ['ID', 'Date', 'User', 'Against expense', 'Amount', 'Reference', 'Payment mode', 'Status'],
      rows: (sortedReimbursements ?? []).map((r) => [
        r.display_id ?? '',
        fmtDate(r.date),
        userOf(r)?.name ?? '',
        againstOf(r),
        r.amount,
        r.reference ?? '',
        r.payment_mode ?? '',
        r.approved_by ? `Approved by ${approverOf(r)?.name ?? '—'}` : 'Pending approval',
      ]),
    },
  ]

  return (
    <details className="toggle-section">
      <summary>Reimbursement records</summary>

      <div className="toolbar">
        <div className="pill-tabs" style={{ flexWrap: 'wrap' }}>
          <button type="button" className={userId === '' ? 'pill active' : 'pill'} onClick={() => setUserId('')}>
            All
          </button>
          {(profiles ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              className={userId === p.id ? 'pill active' : 'pill'}
              onClick={() => setUserId(p.id)}
            >
              {p.name.toUpperCase()}
            </button>
          ))}
        </div>
        <ReportExportButtons title="Reimbursement records" sections={exportSections} range={null} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableSearch value={search} onChange={setSearch} />
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="User" sortKey="user" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Against expense" sortKey="expense" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th>Reference</th>
              <th>Payment mode</th>
              <th>Status</th>
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
            {!isLoading && (!sortedReimbursements || sortedReimbursements.length === 0) && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No reimbursements recorded
                </td>
              </tr>
            )}
            {pageRows?.map((r) => {
              const expense = expenseOf(r)
              const user = userOf(r)
              const against = againstOf(r)
              const approver = approverOf(r)
              const isApproved = !!r.approved_by
              const canApprove = !isApproved && r.created_by !== profile?.id
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>{r.display_id ?? '—'}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{user?.name ?? '—'}</td>
                    <td>{against || '—'}</td>
                    <td className="amt">{fmt(r.amount)}</td>
                    <td>{r.reference ?? '—'}</td>
                    <td>{r.payment_mode ?? '—'}</td>
                    <td>{isApproved ? `Approved · ${approver?.name ?? '—'}` : 'Pending'}</td>
                    <td>
                      <RowMenu
                        items={[
                          { label: 'Approve', disabled: !canApprove, onClick: () => approveReimbursement.mutate({ id: r.id, approverId: profile!.id }) },
                          { label: 'Edit', disabled: isApproved, onClick: () => setEditingReimbursement(r) },
                          { label: 'Remove', disabled: isApproved, onClick: () => deleteReimbursement.mutate(r.id) },
                        ]}
                      />
                    </td>
                  </tr>
                  {editingReimbursement?.id === r.id && (expense || vendorPaymentOf(r)) && (
                    <ExpenseReimbursementForm
                      expenseId={expense?.id}
                      due={0}
                      editingReimbursement={editingReimbursement}
                      colSpan={9}
                      onClose={() => setEditingReimbursement(null)}
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
