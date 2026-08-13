import { Fragment, useState } from 'react'
import { Button } from '../../components/ui'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { CostCenterPicker } from '../../components/CostCenterPicker'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import {
  useExpenses,
  useDeleteExpense,
  useBulkUpdateExpenses,
  useBulkDeleteExpenses,
  useExpenseReimbursements,
  useDeleteExpenseReimbursement,
  useApproveExpenseReimbursement,
} from '../../lib/queries/expenses'
import { useProjects, useClients, useVendors, useCostCenters } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { expenseReimbursed, expenseDue } from '../../lib/calc/expenses'
import type { DateRange } from '../../lib/calc/period'
import { ReceiptLink } from '../../components/ReceiptLink'
import { clientLabel } from '../../lib/labels'
import { ExpenseReimbursementForm } from './ExpenseReimbursementForm'
import { ExpenseForm } from './ExpenseForm'
import type { Database } from '../../types/database'

type ExpenseReimbursement = Database['public']['Tables']['expense_reimbursements']['Row']

const COL_SPAN = 7

export function ExpenseTable() {
  const { profile } = useAuth()
  const [range, setRange] = useState<DateRange | null>(null)
  const [idSearch, setIdSearch] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const { data: expenses, isLoading } = useExpenses(range)
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: profiles } = useProfiles()
  const { data: costCenters } = useCostCenters()
  const { data: reimbursements } = useExpenseReimbursements()
  const deleteExpense = useDeleteExpense()
  const bulkUpdateExpenses = useBulkUpdateExpenses()
  const bulkDeleteExpenses = useBulkDeleteExpenses()
  const deleteReimbursement = useDeleteExpenseReimbursement()
  const approveReimbursement = useApproveExpenseReimbursement()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCostCenter, setBulkCostCenter] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const [editingReimbursement, setEditingReimbursement] = useState<ExpenseReimbursement | null>(null)

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkCostCenter('')
  }

  async function applyBulkCostCenter() {
    if (!bulkCostCenter || selectedIds.size === 0) return
    await bulkUpdateExpenses.mutateAsync({ ids: Array.from(selectedIds), patch: { cost_center: bulkCostCenter } })
    clearSelection()
  }

  async function applyBulkReimbursable(value: boolean) {
    if (selectedIds.size === 0) return
    await bulkUpdateExpenses.mutateAsync({ ids: Array.from(selectedIds), patch: { reimbursable: value } })
    clearSelection()
  }

  async function removeSelected() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Remove ${selectedIds.size} selected expense${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    await bulkDeleteExpenses.mutateAsync(Array.from(selectedIds))
    clearSelection()
  }

  function closePayForm() {
    setPayFormId(null)
    setEditingReimbursement(null)
  }

  function openAddReimbursement(expenseId: string) {
    setEditingReimbursement(null)
    setPayFormId(expenseId)
  }

  function openEditReimbursement(expenseId: string, reimbursement: ExpenseReimbursement) {
    setEditingReimbursement(reimbursement)
    setPayFormId(expenseId)
  }

  const projectCodeOf = (e: NonNullable<typeof expenses>[number]) => projects?.find((p) => p.id === e.project_id)?.display_id ?? ''

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
  const reimbursementsOf = (e: NonNullable<typeof expenses>[number]) =>
    reimbursements?.filter((r) => r.expense_id === e.id) ?? []
  const approverNameOf = (r: NonNullable<typeof reimbursements>[number]) =>
    (r.approved_by && profiles?.find((p) => p.id === r.approved_by)?.name) || '—'
  const reimbursedOf = (e: NonNullable<typeof expenses>[number]) => expenseReimbursed(reimbursementsOf(e))
  const dueOf = (e: NonNullable<typeof expenses>[number]) => (e.reimbursable ? expenseDue(e.amount, reimbursementsOf(e)) : 0)

  const idFiltered = idSearch.trim()
    ? expenses?.filter((e) => e.display_id?.toLowerCase().includes(idSearch.trim().toLowerCase()))
    : expenses
  const userFiltered = userFilter ? idFiltered?.filter((e) => e.created_by === userFilter) : idFiltered
  const { sorted: sortedExpenses, sortKey, direction, toggleSort } = useSort(
    userFiltered,
    {
      id: (e) => e.display_id,
      date: (e) => e.date,
      description: (e) => e.description,
      costCenter: (e) => e.cost_center,
      amount: (e) => e.amount,
    },
    'id'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedExpenses)

  const pageIds = (pageRows ?? []).map((e) => e.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const exportSections: ExportSection[] = [
    {
      title: 'Expense records',
      columns: ['ID', 'Date', 'Vendor', 'Description', 'Remarks', 'Project / client', 'Cost center', 'Purpose', 'Amount', 'Reimbursable', 'Reimbursed', 'Due', 'Recorded by'],
      rows: (sortedExpenses ?? []).map((e) => [
        e.display_id ?? '',
        fmtDate(e.date),
        vendorNameOf(e),
        e.description,
        e.remarks ?? '',
        projLabelOf(e),
        e.cost_center ?? '',
        e.purpose ?? '',
        e.amount,
        e.reimbursable ? 'Yes' : 'No',
        e.reimbursable ? reimbursedOf(e) : '—',
        e.reimbursable ? dueOf(e) : '—',
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
          <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
            <label>By user</label>
            <SearchableSelect
              items={profiles}
              value={userFilter}
              onChange={setUserFilter}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— All users —"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ReportExportButtons
            title="Expense records"
            sections={exportSections}
            range={range}
            style={{ marginTop: 0 }}
          />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '8px 12px',
            marginTop: 10,
          }}
        >
          <strong style={{ fontSize: 13 }}>{selectedIds.size} selected</strong>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <CostCenterPicker value={bulkCostCenter} onChange={setBulkCostCenter} costCenters={costCenters} />
            <Button type="button" variant="secondary" disabled={!bulkCostCenter} onClick={applyBulkCostCenter}>
              Set cost center
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={() => applyBulkReimbursable(true)}>
            Mark reimbursable
          </Button>
          <Button type="button" variant="secondary" onClick={() => applyBulkReimbursable(false)}>
            Mark not reimbursable
          </Button>
          <Button type="button" className="danger-link" onClick={removeSelected}>
            Remove selected
          </Button>
          <Button type="button" variant="secondary" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <TableScroll>
        <table className="data table-compact">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} aria-label="Select all on page" />
              </th>
              <th></th>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Cost center" sortKey="costCenter" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={COL_SPAN} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedExpenses || sortedExpenses.length === 0) && (
              <tr>
                <td colSpan={COL_SPAN} className="empty-row">
                  {idSearch.trim()
                    ? `No expenses match "${idSearch.trim()}"`
                    : userFilter
                      ? 'No expenses for this user in this period'
                      : 'No expenses in this period'}
                </td>
              </tr>
            )}
            {pageRows?.map((e) => {
              const projLabel = projLabelOf(e)
              const vendorName = vendorNameOf(e)
              const expReimbursements = reimbursementsOf(e)
              const reimbursed = reimbursedOf(e)
              const due = dueOf(e)
              const hasHistory = expReimbursements.length > 0
              const isExpanded = expandedIds.has(e.id)

              return (
                <Fragment key={e.id}>
                  <tr>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelected(e.id)} aria-label={`Select ${e.display_id ?? 'row'}`} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-expand-btn"
                        onClick={() => toggleExpanded(e.id)}
                        aria-label={isExpanded ? 'Hide details' : 'Show details'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td>{e.display_id ?? '—'}</td>
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.description}</td>
                    <td>
                      {e.cost_center ?? '—'}
                      {e.cost_center === 'Projects' && (projectCodeOf(e) || e.purpose) && (
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {[projectCodeOf(e), e.purpose].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="amt">{fmt(e.amount)}</td>
                  </tr>
                  {isExpanded && editingId === e.id && (
                    <tr className="pay-form-row">
                      <td colSpan={COL_SPAN}>
                        <ExpenseForm editingExpense={e} onDoneEditing={() => setEditingId(null)} />
                      </td>
                    </tr>
                  )}
                  {isExpanded && editingId !== e.id && (
                    <tr className="pay-form-row">
                      <td colSpan={COL_SPAN}>
                        <div className="row-menu-info" style={{ padding: 0, border: 'none' }}>
                          <div>
                            <strong>Project / client:</strong> {projLabel || '—'}
                          </div>
                          <div>
                            <strong>Vendor:</strong> {vendorName || '—'}
                          </div>
                          <div>
                            <strong>Remarks:</strong> {e.remarks ?? '—'}
                          </div>
                          <div>
                            <strong>Recorded by:</strong> {userNameOf(e) || '—'}
                          </div>
                          <div>
                            <strong>Location:</strong>{' '}
                            {e.geo_lat != null && e.geo_lng != null ? (
                              <a href={`https://maps.google.com/?q=${e.geo_lat},${e.geo_lng}`} target="_blank" rel="noopener">
                                view
                              </a>
                            ) : (
                              '—'
                            )}
                          </div>
                          <div>
                            <strong>Receipt:</strong> {e.receipt_path ? <ReceiptLink path={e.receipt_path} /> : '—'}
                          </div>
                          <div>
                            <strong>Reimbursable:</strong> {e.reimbursable ? 'Yes' : 'No'}
                          </div>
                          {e.reimbursable && (
                            <>
                              <div>
                                <strong>Reimbursed:</strong> {fmt(reimbursed)}
                              </div>
                              <div>
                                <strong>Due:</strong> {fmt(due)}
                              </div>
                            </>
                          )}
                        </div>
                        {hasHistory && (
                          <div className="pay-history" style={{ marginTop: 6 }}>
                            {expReimbursements.map((r) => {
                              const isApproved = !!r.approved_by
                              const canApprove = !isApproved && r.created_by !== profile?.id
                              return (
                                <div key={r.id} className="pay-history-line">
                                  <span>
                                    {r.display_id} — {fmtDate(r.date)} — {fmt(r.amount)}
                                    {r.payment_mode ? ` · ${r.payment_mode}` : ''}
                                    {r.reference ? ` · ${r.reference}` : ''}
                                    {' · '}
                                    {isApproved ? `Approved · ${approverNameOf(r)}` : 'Pending'}
                                  </span>
                                  {canApprove && (
                                    <button
                                      type="button"
                                      className="pay-history-edit"
                                      onClick={() => approveReimbursement.mutate({ id: r.id, approverId: profile!.id })}
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {!isApproved && (
                                    <>
                                      <button
                                        type="button"
                                        className="pay-history-edit"
                                        onClick={() => openEditReimbursement(e.id, r)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="pay-history-edit"
                                        onClick={() => deleteReimbursement.mutate(r.id)}
                                      >
                                        Remove
                                      </button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button type="button" className="pay-btn" onClick={() => setEditingId(e.id)}>
                            Edit
                          </button>
                          <button type="button" className="btn danger-link" onClick={() => deleteExpense.mutate(e.id)}>
                            Remove
                          </button>
                          <button
                            type="button"
                            className="pay-btn"
                            disabled={!e.reimbursable || due <= 0}
                            onClick={() => openAddReimbursement(e.id)}
                          >
                            Record reimbursement
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {payFormId === e.id && (
                    <ExpenseReimbursementForm
                      expenseId={e.id}
                      due={due}
                      editingReimbursement={editingReimbursement}
                      colSpan={COL_SPAN}
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
