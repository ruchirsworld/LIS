import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { Button } from '../../components/ui'
import { useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useExpenses, useUpdateExpense } from '../../lib/queries/expenses'
import { useSiteImprestBalances } from '../../lib/queries/ledger'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE } from '../../lib/supervisorProjectExpenseCategories'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadSupervisorExpenseImportTemplate } from '../../lib/import/supervisorExpenseTemplate'
import { parseSupervisorExpenseImport, commitSupervisorExpenseImport } from '../../lib/import/runSupervisorExpenseImport'
import type { Database } from '../../types/database'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']

/** Approval queue for every Project expense claim a Supervisor has
 * submitted (already in `expenses`, status 'pending') but that hasn't
 * become a settled record yet — grouped by date under whichever Supervisor
 * is picked, since claims fund from that Supervisor's own Site Imprest
 * float automatically. */
export function PendingClaimApprovals() {
  const { data: pendingSupervisor } = useExpenses(null, 'pending')
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: profiles } = useProfiles()
  const { data: imprestBalances } = useSiteImprestBalances()
  const updateExpense = useUpdateExpense()
  const activeProjects = projects?.filter((p) => p.status === 'active')
  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')

  const [supervisorId, setSupervisorId] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null)
  const [supervisorDraft, setSupervisorDraft] = useState({ projectId: '', amount: '', date: '', description: '' })

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
  const claimDates = [...supervisorByDate.keys()].sort((a, b) => b.localeCompare(a))
  const imprestBalance = supervisorId ? imprestBalances?.get(supervisorId) ?? 0 : 0

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

  function renderSupervisorRow(e: ExpenseRow) {
    if (editingSupervisorId === e.id) {
      return (
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
              <Button type="button" variant="secondary" disabled={busyKey === e.id} onClick={() => setEditingSupervisorId(null)}>
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
      )
    }
    return (
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
  }

  return (
    <details className="toggle-section" open>
      <summary>Pending expense approvals</summary>
      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Claims</h3>
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

        <ImportFileBlock
          label="Bulk-add Supervisor Project expense claims from Excel"
          onDownload={downloadSupervisorExpenseImportTemplate}
          onParse={parseSupervisorExpenseImport}
          onCommit={commitSupervisorExpenseImport}
          invalidateKeys={['expenses', 'pending-field-expenses']}
        />

        {!supervisorId ? (
          <div className="note">Pick a supervisor to see their pending claims.</div>
        ) : claimDates.length === 0 ? (
          <div className="note">Nothing waiting on approval for this supervisor.</div>
        ) : (
          claimDates.map((date, i) => {
            const rows = supervisorByDate.get(date)!
            const dayTotal = rows.reduce((s, e) => s + Number(e.amount || 0), 0)
            const exceedsImprest = dayTotal > imprestBalance
            return (
              <details key={date} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>
                  {fmtDate(date)} — {fmt(dayTotal)}
                </summary>
                {exceedsImprest && (
                  <div className="note" style={{ color: 'var(--red)', fontWeight: 700, marginTop: 4 }}>
                    Exceeds this Supervisor's site imprest balance
                  </div>
                )}
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>{rows.map(renderSupervisorRow)}</tbody>
                  </table>
                </div>
                {rows.some((e) => e.description) && (
                  <details className="toggle-section" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
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
      </div>
    </details>
  )
}
