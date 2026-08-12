import { Fragment, useState } from 'react'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import {
  useExpenses,
  useExpenseReimbursements,
  useDeleteExpenseReimbursement,
  useApproveExpenseReimbursement,
} from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { ExpenseReimbursementForm } from './ExpenseReimbursementForm'
import type { Database } from '../../types/database'

type ExpenseReimbursement = Database['public']['Tables']['expense_reimbursements']['Row']

export function ReimbursementRecordsTable() {
  const { profile } = useAuth()
  const { data: reimbursements, isLoading } = useExpenseReimbursements()
  const { data: expenses } = useExpenses(null)
  const { data: profiles } = useProfiles()
  const deleteReimbursement = useDeleteExpenseReimbursement()
  const approveReimbursement = useApproveExpenseReimbursement()

  const [userId, setUserId] = useState('')
  const [editingReimbursement, setEditingReimbursement] = useState<ExpenseReimbursement | null>(null)

  const expenseOf = (r: ExpenseReimbursement) => expenses?.find((e) => e.id === r.expense_id)
  const userOf = (r: ExpenseReimbursement) => {
    const expense = expenseOf(r)
    return expense?.created_by ? profiles?.find((p) => p.id === expense.created_by) : undefined
  }
  const approverOf = (r: ExpenseReimbursement) => (r.approved_by ? profiles?.find((p) => p.id === r.approved_by) : undefined)

  const userFiltered = userId ? (reimbursements ?? []).filter((r) => userOf(r)?.id === userId) : reimbursements

  const { sorted: sortedReimbursements, sortKey, direction, toggleSort } = useSort(
    userFiltered,
    {
      id: (r) => r.display_id,
      date: (r) => r.date,
      user: (r) => userOf(r)?.name ?? '',
      expense: (r) => expenseOf(r)?.display_id ?? '',
      amount: (r) => r.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedReimbursements)

  const exportSections: ExportSection[] = [
    {
      title: 'Reimbursement records',
      columns: ['ID', 'Date', 'User', 'Against expense', 'Amount', 'Reference', 'Payment mode', 'Status'],
      rows: (sortedReimbursements ?? []).map((r) => [
        r.display_id ?? '',
        fmtDate(r.date),
        userOf(r)?.name ?? '',
        expenseOf(r)?.display_id ?? '',
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
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
        <ReportExportButtons title="Reimbursement records" sections={exportSections} range={null} style={{ marginTop: 0 }} />
      </div>

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
              const approver = approverOf(r)
              const isApproved = !!r.approved_by
              const canApprove = !isApproved && r.created_by !== profile?.id
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>{r.display_id ?? '—'}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{user?.name ?? '—'}</td>
                    <td>{expense?.display_id ?? '—'}</td>
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
                  {editingReimbursement?.id === r.id && expense && (
                    <ExpenseReimbursementForm
                      expenseId={expense.id}
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
