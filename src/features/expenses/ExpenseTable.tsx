import { confirmAction } from '../../lib/feedback'
import { Fragment, useState } from 'react'
import { useNavFilter } from '../../lib/navContext'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { Modal } from '../../components/Modal'
import { CostCenterPicker } from '../../components/CostCenterPicker'
import { useSort } from '../../lib/useSort'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import type { DateRange } from '../../lib/calc/period'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
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
import { useProjects, useClients, useVendors, useCostCenters, useExpenseSubHeads } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { fmt, fmtDate } from '../../lib/calc/format'
import { expenseReimbursed, expenseDue } from '../../lib/calc/expenses'
import { ReceiptLink } from '../../components/ReceiptLink'
import { clientLabel, clientFullName } from '../../lib/labels'
import { ExpenseReimbursementForm } from './ExpenseReimbursementForm'
import { ExpenseForm } from './ExpenseForm'
import type { Database } from '../../types/database'

type ExpenseReimbursement = Database['public']['Tables']['expense_reimbursements']['Row']

const COL_SPAN = 8

export function ExpenseTable({
  costCenterFilter,
  title = 'Expense records',
  groupByDate = false,
}: {
  /** Only show expenses with this exact cost_center — e.g. "Project" on the
   * Project section. Omit to show everything, as on the Admin section. */
  costCenterFilter?: string
  title?: string
  /** Cluster rows under a date heading (with that day's total) instead of a
   * flat sortable list — used on the Project section, where "which day did
   * this cost land on" matters more than sorting by amount/description. To
   * keep the groups contiguous, only the Date column stays sortable. */
  groupByDate?: boolean
} = {}) {
  const { profile } = useAuth()
  // This table only ever renders inside Admin/CXO-only sections, so both
  // already reach it — canEdit just makes that explicit. Deleting is
  // heavier (un-does the record entirely) and restricted to Admin only,
  // matching the same precedent used for Imprest transactions and Trips.
  const canEdit = profile?.role === 'admin' || profile?.role === 'cxo'
  const canDelete = profile?.role === 'admin'
  const [range, setRange] = useState<DateRange | null>(null)
  const nav = useNavFilter('expenses')
  const [userFilter, setUserFilter] = useState('')
  const [search, setSearch] = useState('')
  const { data: rawExpenses, isLoading } = useExpenses(range)
  const expenses = costCenterFilter ? rawExpenses?.filter((e) => e.cost_center === costCenterFilter) : rawExpenses
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: profiles } = useProfiles()
  const { data: costCenters } = useCostCenters()
  const { data: subHeads } = useExpenseSubHeads()
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
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  function toggleMonthGroup(month: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  function toggleDateGroup(date: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

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
    const ok = await confirmAction({
      title: 'Remove expenses',
      message: `Remove ${selectedIds.size} selected expense${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    await bulkDeleteExpenses.mutateAsync(Array.from(selectedIds))
    clearSelection()
  }

  async function removeOne(e: NonNullable<typeof expenses>[number]) {
    const ok = await confirmAction({
      title: 'Delete expense',
      message: `Delete ${e.display_id ?? 'this expense'} of ${fmt(e.amount)} dated ${fmtDate(e.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteExpense.mutate(e.id)
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

  const projectNameOf = (e: NonNullable<typeof expenses>[number]) => projects?.find((p) => p.id === e.project_id)?.name ?? ''

  const projLabelOf = (e: NonNullable<typeof expenses>[number]) => {
    const project = projects?.find((p) => p.id === e.project_id)
    const client = project ? clients?.find((c) => c.id === project.client_id) : null
    return project ? `${project.name} — ${clientLabel(client)}` : ''
  }
  const projLabelForExportOf = (e: NonNullable<typeof expenses>[number]) => {
    const project = projects?.find((p) => p.id === e.project_id)
    const client = project ? clients?.find((c) => c.id === project.client_id) : null
    return project ? `${project.name} — ${clientFullName(client)}` : ''
  }
  const vendorNameOf = (e: NonNullable<typeof expenses>[number]) => {
    const vendor = e.vendor_id ? vendors?.find((v) => v.id === e.vendor_id) : null
    return vendor?.name ?? ''
  }
  const subHeadNameOf = (e: NonNullable<typeof expenses>[number]) => {
    const subHead = e.sub_head_id ? subHeads?.find((s) => s.id === e.sub_head_id) : null
    return subHead?.name ?? ''
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

  const byUser = userFilter ? expenses?.filter((e) => e.created_by === userFilter) : expenses
  const userFiltered = search
    ? byUser?.filter((e) =>
        matchesSearch(search, [e.display_id, e.description, e.remarks, e.purpose, e.date, e.amount, e.cost_center, e.payment_mode, e.status, projLabelOf(e), vendorNameOf(e), subHeadNameOf(e), userNameOf(e), e.reimbursable ? 'reimbursable reimbursement' : ''])
      )
    : byUser
  const { sorted: sortedExpenses, sortKey, direction, toggleSort } = useSort(
    userFiltered,
    {
      id: (e) => e.display_id,
      date: (e) => e.date,
      description: (e) => e.description,
      costCenter: (e) => e.cost_center,
      amount: (e) => e.amount,
    },
    groupByDate ? 'date' : 'id'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedExpenses, search)

  // Grouped records: months, then dates inside a month. Each date group gets one of two colour families (blue, green) in turn,
  // and the rows inside it alternate light and a little deeper, so every group stands apart from its neighbours.
  const groupSegmentOfDate = new Map<string, 0 | 1>()
  const rowShade = new Map<string, 0 | 1>()
  if (groupByDate) {
    let segment = -1
    let previousDate = ''
    let alternate = 0
    for (const r of pageRows ?? []) {
      if (r.date !== previousDate) {
        segment += 1
        alternate = 0
        previousDate = r.date
        groupSegmentOfDate.set(r.date, (segment % 2) as 0 | 1)
      }
      if (collapsedDates.has(r.date) || collapsedMonths.has(r.date.slice(0, 7))) continue
      rowShade.set(r.id, (alternate % 2) as 0 | 1)
      alternate += 1
    }
  }
  // A month or a day covers every record of it, not only the ones on this page.
  const totalOf = (match: (e: NonNullable<typeof sortedExpenses>[number]) => boolean) => {
    const list = (sortedExpenses ?? []).filter(match)
    return { count: list.length, total: list.reduce((s, r) => s + Number(r.amount || 0), 0) }
  }

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
      title,
      columns: ['ID', 'Date', 'Vendor', 'Description', 'Remarks', 'Project / client', 'Cost center', 'Sub-head', 'Amount', 'Reimbursable', 'Reimbursed', 'Due', 'Recorded by'],
      rows: (sortedExpenses ?? []).map((e) => [
        e.display_id ?? '',
        fmtDate(e.date),
        vendorNameOf(e),
        e.description,
        e.remarks ?? '',
        projLabelForExportOf(e),
        e.cost_center ?? '',
        subHeadNameOf(e),
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
      <summary>{title}</summary>

      <div className="toolbar">
        <div className="toolbar-group">
          <PeriodFilterToggle
            range={range}
            onChange={setRange}
            preset={nav?.filter.range ? { ...nav.filter.range, nonce: nav.nonce } : undefined}
          />
          <div className="field" style={{ maxWidth: 160 }}>
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
        <ReportExportButtons title={title} sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
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
          {canEdit && (
            <>
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
            </>
          )}
          {canDelete && (
            <Button type="button" className="danger-link" onClick={removeSelected}>
              Remove selected
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <TableSearch value={search} onChange={setSearch} />
      <TableScroll>
        <table className="data table-compact">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} aria-label="Select all on page" />
              </th>
              <th></th>
              {groupByDate ? (
                <th>ID</th>
              ) : (
                <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              )}
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              {groupByDate ? (
                <th style={{ textAlign: 'right' }}>Amount</th>
              ) : (
                <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              )}
              {groupByDate ? (
                <th>Description</th>
              ) : (
                <SortableTh label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              )}
              {groupByDate ? (
                <th>Cost center</th>
              ) : (
                <SortableTh label="Cost center" sortKey="costCenter" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              )}
              <th></th>
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
                  {userFilter ? 'No expenses for this user in this period' : 'No expenses in this period'}
                </td>
              </tr>
            )}
            {pageRows?.map((e, idx) => {
              const projLabel = projLabelOf(e)
              const vendorName = vendorNameOf(e)
              const expReimbursements = reimbursementsOf(e)
              const reimbursed = reimbursedOf(e)
              const due = dueOf(e)
              const hasHistory = expReimbursements.length > 0
              const isExpanded = expandedIds.has(e.id)
              const month = e.date.slice(0, 7)
              const isNewMonthGroup = groupByDate && (idx === 0 || pageRows[idx - 1].date.slice(0, 7) !== month)
              const isMonthCollapsed = groupByDate && collapsedMonths.has(month)
              const monthSummary = isNewMonthGroup ? totalOf((r) => r.date.slice(0, 7) === month) : null
              const isNewDateGroup = groupByDate && (idx === 0 || pageRows[idx - 1].date !== e.date)
              const daySummary = isNewDateGroup ? totalOf((r) => r.date === e.date) : null
              const isDateCollapsed = groupByDate && collapsedDates.has(e.date)
              const segment = groupSegmentOfDate.get(e.date) ?? 0
              const shade = rowShade.get(e.id) ?? 0

              return (
                <Fragment key={e.id}>
                  {monthSummary && (
                    <tr className="expense-month-group-row" onClick={() => toggleMonthGroup(month)} style={{ cursor: 'pointer' }}>
                      <td colSpan={COL_SPAN}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                          <span>
                            <span style={{ display: 'inline-block', width: 16, fontSize: 12, opacity: 0.6 }}>{isMonthCollapsed ? '▸' : '▾'}</span>
                            {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {monthSummary.count} entr{monthSummary.count === 1 ? 'y' : 'ies'} · {fmt(monthSummary.total)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isNewDateGroup && daySummary && !isMonthCollapsed && (
                    <tr className={`expense-date-group-row grp-head-${segment}`} onClick={() => toggleDateGroup(e.date)} style={{ cursor: 'pointer' }}>
                      <td colSpan={COL_SPAN} style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 14, fontSize: 11, opacity: 0.6 }}>
                          {isDateCollapsed ? '▸' : '▾'}
                        </span>
                        {fmtDate(e.date)} — {fmt(daySummary.total)}
                      </td>
                    </tr>
                  )}
                  {!isDateCollapsed && !isMonthCollapsed && (
                    <>
                  <tr
                    className={[groupByDate ? `grp-row grp-seg-${segment} grp-alt-${shade}` : '', e.reimbursable ? 'row-reimb' : ''].filter(Boolean).join(' ') || undefined}
                    title={e.reimbursable ? 'Recorded as reimbursement' : undefined}
                  >
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
                    <td className="amt">{fmt(e.amount)}</td>
                    <td>{e.description}</td>
                    <td>
                      {e.cost_center ?? '—'}
                      {(projectNameOf(e) || subHeadNameOf(e)) && (
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {[projectNameOf(e), subHeadNameOf(e)].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ width: 40, textAlign: 'right' }}>
                      <RowMenu
                        items={[
                          { label: 'Record reimbursement', disabled: !e.reimbursable || due <= 0, onClick: () => openAddReimbursement(e.id) },
                          ...(canEdit ? [{ label: 'Edit', onClick: () => setEditingId(e.id) }] : []),
                          ...(canDelete ? [{ label: 'Delete', onClick: () => void removeOne(e) }] : []),
                        ]}
                      />
                    </td>
                  </tr>
                  {isExpanded && (
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
                    </>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editingId && expenses?.find((x) => x.id === editingId) && (
        <Modal title={`Edit expense ${expenses.find((x) => x.id === editingId)?.display_id ?? ''}`} onClose={() => setEditingId(null)}>
          <ExpenseForm editingExpense={expenses.find((x) => x.id === editingId) ?? null} onDoneEditing={() => setEditingId(null)} />
        </Modal>
      )}
    </details>
  )
}
