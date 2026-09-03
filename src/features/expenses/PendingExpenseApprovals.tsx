import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { SearchableSelect } from '../../components/SearchableSelect'
import { Button } from '../../components/ui'
import { useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import {
  useExpenses,
  useUpdateExpense,
  useCreateExpense,
  usePendingFieldExpenses,
  type PendingFieldExpense,
} from '../../lib/queries/expenses'
import { useSiteImprestBalances } from '../../lib/queries/ledger'
import { FIELD_CATEGORY_TO_SUBHEAD_CODE } from '../../lib/fieldExpenseMapping'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE } from '../../lib/supervisorProjectExpenseCategories'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']

/** One approval queue for every expense claim that hasn't become a real
 * record yet. A Supervisor's own Project claims (already in `expenses`,
 * status 'pending') are grouped by date under whichever Supervisor is
 * picked — they fund from that Supervisor's own Site Imprest float
 * automatically. Field-worker claims from LIS_Fields aren't tied to an
 * ERP2.0 Supervisor account at all (a separate app's own user roster), so
 * they're their own date-grouped list below, each needing its own Project
 * picked since LIS_Fields has no concept of one. */
export function PendingExpenseApprovals() {
  const qc = useQueryClient()
  const { data: pendingSupervisor } = useExpenses(null, 'pending')
  const { data: pendingField, isLoading: fieldLoading, error: fieldError } = usePendingFieldExpenses()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: profiles } = useProfiles()
  const { data: imprestBalances } = useSiteImprestBalances()
  const updateExpense = useUpdateExpense()
  const createExpense = useCreateExpense()
  const activeProjects = projects?.filter((p) => p.status === 'active')
  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')

  const [supervisorId, setSupervisorId] = useState('')
  const [projectByRow, setProjectByRow] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  // Supervisor claims are real `expenses` rows — editing writes straight to
  // the record. Field expenses aren't a record yet (they're created only on
  // approve), so their edits are held as local overrides until then.
  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null)
  const [supervisorDraft, setSupervisorDraft] = useState({ projectId: '', amount: '', date: '', description: '' })
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState({ amount: '', description: '' })
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, { amount: number; description: string }>>({})

  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')
  // The Chart of Accounts sub-head name (e.g. "Project Transportation") isn't
  // what a Supervisor picked when filing the claim — map its code back to
  // the same fixed category label the claim form and import sheet use
  // ("Transport", "Labour", ...) so this matches what they actually entered.
  const claimCategoryLabelByCode = new Map<string, string>([[LABOUR_SUB_HEAD_CODE, 'Labour']])
  for (const c of FIXED_EXPENSE_CATEGORIES) claimCategoryLabelByCode.set(c.subHeadCode, c.label)
  const categoryName = (id: string | null) => {
    if (!id) return '—'
    const subHead = subHeads?.find((s) => s.id === id)
    if (!subHead) return '—'
    return claimCategoryLabelByCode.get(subHead.code) ?? subHead.name
  }

  const supervisorPending = (pendingSupervisor ?? []).filter((e) => e.cost_center === 'Project' && e.created_by === supervisorId)
  const supervisorByDate = new Map<string, ExpenseRow[]>()
  for (const e of supervisorPending) {
    const list = supervisorByDate.get(e.date) ?? []
    list.push(e)
    supervisorByDate.set(e.date, list)
  }
  const supervisorDates = [...supervisorByDate.keys()].sort((a, b) => b.localeCompare(a))
  const imprestBalance = supervisorId ? imprestBalances?.get(supervisorId) ?? 0 : 0

  const fieldByDate = new Map<string, PendingFieldExpense[]>()
  for (const exp of pendingField ?? []) {
    const list = fieldByDate.get(exp.date) ?? []
    list.push(exp)
    fieldByDate.set(exp.date, list)
  }
  const fieldDates = [...fieldByDate.keys()].sort((a, b) => b.localeCompare(a))

  async function handleApproveSupervisor(e: ExpenseRow) {
    setBusyKey(e.id)
    setRowError((m) => ({ ...m, [e.id]: '' }))
    try {
      await updateExpense.mutateAsync({
        id: e.id,
        patch: { status: 'approved', paid_from_imprest: true, reimbursable: false, payment_mode: null, bank_account_id: null },
      })
    } catch (err) {
      setRowError((m) => ({ ...m, [e.id]: getErrorMessage(err, 'Could not approve this claim.') }))
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRejectSupervisor(e: ExpenseRow) {
    setBusyKey(e.id)
    try {
      await updateExpense.mutateAsync({ id: e.id, patch: { status: 'rejected' } })
    } finally {
      setBusyKey(null)
    }
  }

  function startEditSupervisor(e: ExpenseRow) {
    setEditingSupervisorId(e.id)
    setSupervisorDraft({
      projectId: e.project_id ?? '',
      amount: String(e.amount),
      date: e.date,
      description: e.description ?? '',
    })
  }

  async function handleSaveSupervisor(e: ExpenseRow) {
    const amount = Number(supervisorDraft.amount)
    if (!supervisorDraft.projectId) {
      setRowError((m) => ({ ...m, [e.id]: 'Pick a project.' }))
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setRowError((m) => ({ ...m, [e.id]: 'Amount must be a positive number.' }))
      return
    }
    if (!supervisorDraft.date) {
      setRowError((m) => ({ ...m, [e.id]: 'Date is required.' }))
      return
    }
    setBusyKey(e.id)
    setRowError((m) => ({ ...m, [e.id]: '' }))
    try {
      await updateExpense.mutateAsync({
        id: e.id,
        patch: {
          project_id: supervisorDraft.projectId,
          amount,
          date: supervisorDraft.date,
          description: supervisorDraft.description,
        },
      })
      setEditingSupervisorId(null)
    } catch (err) {
      setRowError((m) => ({ ...m, [e.id]: getErrorMessage(err, 'Could not save these changes.') }))
    } finally {
      setBusyKey(null)
    }
  }

  async function handleApproveField(exp: PendingFieldExpense) {
    const projectId = projectByRow[exp.id]
    if (!projectId) {
      setRowError((m) => ({ ...m, [exp.id]: 'Pick a project first.' }))
      return
    }
    const subHeadCode = FIELD_CATEGORY_TO_SUBHEAD_CODE[exp.category]
    const subHead = subHeads?.find((s) => s.code === subHeadCode)
    if (!subHead) {
      setRowError((m) => ({ ...m, [exp.id]: `No sub-head configured for category "${exp.category}".` }))
      return
    }
    const override = fieldOverrides[exp.id]
    setBusyKey(exp.id)
    setRowError((m) => ({ ...m, [exp.id]: '' }))
    try {
      await createExpense.mutateAsync({
        description: override?.description || exp.description || exp.category,
        cost_center: 'Project',
        project_id: projectId,
        sub_head_id: subHead.id,
        amount: override?.amount ?? exp.amount,
        date: exp.date,
        remarks: `From LIS_Fields — ${exp.profiles?.name ?? 'staff'} @ ${exp.sites?.name ?? 'site'}`,
        reimbursable: true,
        payment_mode: null,
        bank_account_id: null,
      })
      const { error: approveError } = await supabase.functions.invoke('field-expenses-bridge', {
        body: { action: 'approve', id: exp.id },
      })
      if (approveError) throw approveError
      qc.invalidateQueries({ queryKey: ['pending-field-expenses'] })
    } catch (err) {
      setRowError((m) => ({ ...m, [exp.id]: getErrorMessage(err, 'Could not approve this expense.') }))
    } finally {
      setBusyKey(null)
    }
  }

  function startEditField(exp: PendingFieldExpense) {
    setEditingFieldId(exp.id)
    setFieldDraft({
      amount: String(fieldOverrides[exp.id]?.amount ?? exp.amount),
      description: fieldOverrides[exp.id]?.description ?? exp.description ?? '',
    })
  }

  function handleSaveField(exp: PendingFieldExpense) {
    const amount = Number(fieldDraft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setRowError((m) => ({ ...m, [exp.id]: 'Amount must be a positive number.' }))
      return
    }
    setRowError((m) => ({ ...m, [exp.id]: '' }))
    setFieldOverrides((o) => ({ ...o, [exp.id]: { amount, description: fieldDraft.description } }))
    setEditingFieldId(null)
  }

  async function handleRejectField(exp: PendingFieldExpense) {
    setBusyKey(exp.id)
    try {
      const { error: rejectError } = await supabase.functions.invoke('field-expenses-bridge', {
        body: { action: 'reject', id: exp.id },
      })
      if (rejectError) throw rejectError
      qc.invalidateQueries({ queryKey: ['pending-field-expenses'] })
    } catch (err) {
      setRowError((m) => ({ ...m, [exp.id]: getErrorMessage(err, 'Could not reject this expense.') }))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Pending expense approvals</summary>
      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Supervisor claims</h3>
        <div className="field" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label>Supervisor</label>
          <SearchableSelect
            items={supervisors}
            value={supervisorId}
            onChange={setSupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select supervisor —"
          />
        </div>

        {!supervisorId ? (
          <div className="note">Pick a supervisor to see their pending claims.</div>
        ) : supervisorDates.length === 0 ? (
          <div className="note">Nothing waiting on approval for this supervisor.</div>
        ) : (
          supervisorDates.map((date, i) => {
            const rows = supervisorByDate.get(date)!
            const dayTotal = rows.reduce((s, e) => s + Number(e.amount || 0), 0)
            return (
              <details key={date} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>
                  {fmtDate(date)} —{' '}
                  <span style={dayTotal > imprestBalance ? { color: 'var(--red)', fontWeight: 700 } : undefined}>{fmt(dayTotal)}</span>
                </summary>
                <div className="note" style={{ margin: '8px 0 0' }}>
                  Site Imprest balance: <strong style={{ color: 'var(--blue)' }}>{fmt(imprestBalance)}</strong>
                </div>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) =>
                        editingSupervisorId === e.id ? (
                          <tr key={e.id}>
                            <td colSpan={2}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ minWidth: 180 }}>
                                  <SearchableSelect
                                    items={activeProjects}
                                    value={supervisorDraft.projectId}
                                    onChange={(id) => setSupervisorDraft((d) => ({ ...d, projectId: id }))}
                                    getId={(p) => p.id}
                                    getLabel={(p) => p.name}
                                    placeholder="— Select project —"
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    aria-label="Amount"
                                    value={supervisorDraft.amount}
                                    onChange={(ev) => setSupervisorDraft((d) => ({ ...d, amount: ev.target.value }))}
                                    style={{ flex: 1, minWidth: 0 }}
                                  />
                                  <input
                                    type="date"
                                    aria-label="Date"
                                    value={supervisorDraft.date}
                                    onChange={(ev) => setSupervisorDraft((d) => ({ ...d, date: ev.target.value }))}
                                    style={{ flex: 1, minWidth: 0 }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  aria-label="Description"
                                  placeholder="Description"
                                  value={supervisorDraft.description}
                                  onChange={(ev) => setSupervisorDraft((d) => ({ ...d, description: ev.target.value }))}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <Button type="button" disabled={busyKey === e.id} onClick={() => handleSaveSupervisor(e)}>
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={busyKey === e.id}
                                  onClick={() => setEditingSupervisorId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              {rowError[e.id] && (
                                <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                                  {rowError[e.id]}
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : (
                          <tr key={e.id}>
                            <td>
                              {categoryName(e.sub_head_id)}
                              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}>{projectName(e.project_id)}</div>
                            </td>
                            <td className="amt">{fmt(e.amount)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <Button
                                  type="button"
                                  className="icon-btn-sq"
                                  disabled={busyKey === e.id}
                                  onClick={() => handleApproveSupervisor(e)}
                                  title="Approve"
                                  aria-label="Approve"
                                >
                                  ✓
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="icon-btn-sq"
                                  disabled={busyKey === e.id}
                                  onClick={() => handleRejectSupervisor(e)}
                                  title="Reject"
                                  aria-label="Reject"
                                >
                                  ✕
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="icon-btn-sq"
                                  disabled={busyKey === e.id}
                                  onClick={() => startEditSupervisor(e)}
                                  title="Edit"
                                  aria-label="Edit"
                                >
                                  ✎
                                </Button>
                              </div>
                              {rowError[e.id] && (
                                <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                                  {rowError[e.id]}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
                {rows.some((e) => e.description) && (
                  <details className="toggle-section" style={{ marginTop: 8 }}>
                    <summary>Comments</summary>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {rows
                        .filter((e) => e.description)
                        .map((e) => (
                          <li key={e.id} style={{ marginBottom: 4 }}>
                            <strong>{projectName(e.project_id)}</strong> ({fmt(e.amount)}) — {e.description}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </details>
            )
          })
        )}

        <h3 style={{ fontSize: 13, marginTop: 24, marginBottom: 10 }}>Field expenses</h3>
        {fieldLoading && <div className="note">Loading…</div>}
        {fieldError && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {getErrorMessage(fieldError, 'Could not load field expenses.')}
          </div>
        )}
        {!fieldLoading && fieldDates.length === 0 && <div className="note">Nothing waiting on approval.</div>}
        {fieldDates.map((date) => {
          const rows = fieldByDate.get(date)!
          const dayTotal = rows.reduce((s, e) => s + Number(fieldOverrides[e.id]?.amount ?? e.amount ?? 0), 0)
          return (
            <details key={date} className="toggle-section" style={{ marginBottom: 10 }}>
              <summary>
                {fmtDate(date)} — {fmt(dayTotal)}
              </summary>
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Project</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((exp) => {
                      // LIS_Fields' "site" and ERP2.0's "project" are the same
                      // place under two names — default the picker to
                      // whichever project matches the site name, if one does.
                      const siteName = exp.sites?.name ?? ''
                      const matchedProjectId = activeProjects?.find(
                        (p) => p.name.trim().toLowerCase() === siteName.trim().toLowerCase()
                      )?.id
                      const projectValue = projectByRow[exp.id] ?? matchedProjectId ?? ''
                      const override = fieldOverrides[exp.id]
                      const effectiveAmount = override?.amount ?? exp.amount

                      if (editingFieldId === exp.id) {
                        return (
                          <tr key={exp.id}>
                            <td colSpan={2}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  aria-label="Amount"
                                  value={fieldDraft.amount}
                                  onChange={(ev) => setFieldDraft((d) => ({ ...d, amount: ev.target.value }))}
                                />
                                <input
                                  type="text"
                                  aria-label="Description"
                                  placeholder="Description"
                                  value={fieldDraft.description}
                                  onChange={(ev) => setFieldDraft((d) => ({ ...d, description: ev.target.value }))}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ minWidth: 180 }}>
                                <SearchableSelect
                                  items={activeProjects}
                                  value={projectValue}
                                  onChange={(id) => setProjectByRow((p) => ({ ...p, [exp.id]: id }))}
                                  getId={(p) => p.id}
                                  getLabel={(p) => p.name}
                                  placeholder="— Select project —"
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <Button type="button" onClick={() => handleSaveField(exp)}>
                                  Save
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setEditingFieldId(null)}>
                                  Cancel
                                </Button>
                              </div>
                              {rowError[exp.id] && (
                                <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                                  {rowError[exp.id]}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={exp.id}>
                          <td>{exp.category}</td>
                          <td className="amt">{fmt(effectiveAmount)}</td>
                          <td>
                            <div style={{ minWidth: 180 }}>
                              <SearchableSelect
                                items={activeProjects}
                                value={projectValue}
                                onChange={(id) => setProjectByRow((p) => ({ ...p, [exp.id]: id }))}
                                getId={(p) => p.id}
                                getLabel={(p) => p.name}
                                placeholder="— Select project —"
                              />
                            </div>
                            {siteName && !matchedProjectId && (
                              <div className="note" style={{ margin: '4px 0 0' }}>
                                LIS_Fields site: {siteName}
                              </div>
                            )}
                          </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button
                              type="button"
                              className="icon-btn-sq"
                              disabled={busyKey === exp.id}
                              onClick={() => handleApproveField(exp)}
                              title="Approve"
                              aria-label="Approve"
                            >
                              ✓
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="icon-btn-sq"
                              disabled={busyKey === exp.id}
                              onClick={() => handleRejectField(exp)}
                              title="Reject"
                              aria-label="Reject"
                            >
                              ✕
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="icon-btn-sq"
                              disabled={busyKey === exp.id}
                              onClick={() => startEditField(exp)}
                              title="Edit"
                              aria-label="Edit"
                            >
                              ✎
                            </Button>
                          </div>
                          {rowError[exp.id] && (
                            <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                              {rowError[exp.id]}
                            </div>
                          )}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rows.some((exp) => exp.description || exp.receipt_url) && (
                <details className="toggle-section" style={{ marginTop: 8 }}>
                  <summary>Comments</summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {rows
                      .filter((exp) => exp.description || exp.receipt_url)
                      .map((exp) => (
                        <li key={exp.id} style={{ marginBottom: 4 }}>
                          <strong>{exp.category}</strong> ({fmt(exp.amount)}) — {exp.description || '—'}
                          {exp.receipt_url && (
                            <>
                              {' · '}
                              <a href={exp.receipt_url} target="_blank" rel="noreferrer">
                                Receipt
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </details>
          )
        })}
      </div>
    </details>
  )
}
