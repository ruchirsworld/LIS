import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useExpenses, useDeleteExpense, useUpdateExpense } from '../../lib/queries/expenses'
import { useProjects, useClients, useVendors } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'
import { ReceiptLink } from '../../components/ReceiptLink'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'

type Expense = Database['public']['Tables']['expenses']['Row']

export function ExpenseTable({ onEdit }: { onEdit: (expense: Expense) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const [idSearch, setIdSearch] = useState('')
  const { data: expenses, isLoading } = useExpenses(range)
  // Independent of the period filter — "amount still to claim" is a running
  // total, not scoped to whatever date range the table happens to show.
  const { data: allExpenses } = useExpenses(null)
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: profiles } = useProfiles()
  const deleteExpense = useDeleteExpense()
  const updateExpense = useUpdateExpense()

  const reimbursementDue = (allExpenses ?? []).reduce(
    (s, e) => (e.reimbursable && !e.reimbursed ? s + Number(e.amount || 0) : s),
    0
  )

  const projLabelOf = (e: NonNullable<typeof expenses>[number]) => {
    const project = projects?.find((p) => p.id === e.project_id)
    const client = project ? clients?.find((c) => c.id === project.client_id) : null
    return project ? `${project.name} — ${clientLabel(client)}` : ''
  }
  const vendorNameOf = (e: NonNullable<typeof expenses>[number]) => {
    const vendor = e.vendor_id ? vendors?.find((v) => v.id === e.vendor_id) : null
    return vendor?.name ?? ''
  }
  const userNameOf = (e: NonNullable<typeof expenses>[number]) => {
    const profile = e.created_by ? profiles?.find((p) => p.id === e.created_by) : null
    return profile?.name ?? ''
  }

  const idFiltered = idSearch.trim()
    ? expenses?.filter((e) => e.display_id?.toLowerCase().includes(idSearch.trim().toLowerCase()))
    : expenses
  const { sorted: sortedExpenses, sortKey, direction, toggleSort } = useSort(
    idFiltered,
    {
      id: (e) => e.display_id,
      date: (e) => e.date,
      vendor: (e) => vendorNameOf(e),
      description: (e) => e.description,
      type: (e) => e.type,
      project: (e) => projLabelOf(e),
      costCenter: (e) => e.cost_center,
      amount: (e) => e.amount,
      reimbursable: (e) => (e.reimbursable ? 1 : 0),
      reimbursed: (e) => (e.reimbursed ? 1 : 0),
      user: (e) => userNameOf(e),
    },
    'id'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedExpenses)

  const exportSections: ExportSection[] = [
    {
      title: 'Expense records',
      columns: ['ID', 'Date', 'Vendor', 'Description', 'Remarks', 'Type', 'Project / client', 'Cost center', 'Amount', 'Reimbursable', 'Reimbursed', 'Recorded by'],
      rows: (sortedExpenses ?? []).map((e) => [
        e.display_id ?? '',
        fmtDate(e.date),
        vendorNameOf(e),
        e.description,
        e.remarks ?? '',
        e.type,
        projLabelOf(e),
        e.cost_center ?? '',
        e.amount,
        e.reimbursable ? 'Yes' : 'No',
        e.reimbursable ? (e.reimbursed ? 'Yes' : 'No') : '—',
        userNameOf(e),
      ]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Expense records</summary>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
          <div className="field" style={{ maxWidth: 160, marginBottom: 0 }}>
            <label>Search ID</label>
            <input
              type="text"
              placeholder="e.g. Exp/23"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {reimbursementDue > 0 && (
            <span
              style={{
                background: 'var(--red-soft)',
                color: 'var(--red)',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Reimbursement due: {fmt(reimbursementDue)}
            </span>
          )}
          <ReportExportButtons
            title="Expense records"
            sections={exportSections}
            range={range}
            style={{ marginTop: 0 }}
          />
        </div>
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Vendor" sortKey="vendor" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Remarks</th>
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project / client" sortKey="project" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Cost center" sortKey="costCenter" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Location</th>
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Reimb." sortKey="reimbursable" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Reimbursed" sortKey="reimbursed" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Recorded by" sortKey="user" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>Receipt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={15} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedExpenses || sortedExpenses.length === 0) && (
              <tr>
                <td colSpan={15} className="empty-row">
                  {idSearch.trim() ? `No expenses match "${idSearch.trim()}"` : 'No expenses in this period'}
                </td>
              </tr>
            )}
            {pageRows?.map((e) => {
              const projLabel = projLabelOf(e)
              const vendorName = vendorNameOf(e)

              return (
                <tr key={e.id}>
                  <td>{e.display_id ?? '—'}</td>
                  <td>{fmtDate(e.date)}</td>
                  <td>{vendorName || '—'}</td>
                  <td>{e.description}</td>
                  <td>{e.remarks ?? '—'}</td>
                  <td>{e.type}</td>
                  <td>{projLabel || '—'}</td>
                  <td>{e.cost_center ?? '—'}</td>
                  <td>
                    {e.geo_lat != null && e.geo_lng != null ? (
                      <a
                        href={`https://maps.google.com/?q=${e.geo_lat},${e.geo_lng}`}
                        target="_blank"
                        rel="noopener"
                      >
                        📍 view
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="amt">{fmt(e.amount)}</td>
                  <td>{e.reimbursable ? 'Yes' : 'No'}</td>
                  <td>
                    {e.reimbursable ? (
                      <input
                        type="checkbox"
                        checked={e.reimbursed}
                        onChange={(ev) =>
                          updateExpense.mutate({ id: e.id, patch: { reimbursed: ev.target.checked } })
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{userNameOf(e) || '—'}</td>
                  <td>{e.receipt_path ? <ReceiptLink path={e.receipt_path} /> : '—'}</td>
                  <td>
                    <button type="button" className="pay-btn" onClick={() => onEdit(e)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger-link"
                      onClick={() => deleteExpense.mutate(e.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
