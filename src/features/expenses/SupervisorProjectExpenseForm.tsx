import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProjects, useExpenseSubHeads, useStaff } from '../../lib/queries/masters'
import { useCreateExpense } from '../../lib/queries/expenses'
import { useStaffImprestTransactions, useCreateStaffImprestTransaction } from '../../lib/queries/hr'
import {
  useAppSettings,
  TEAM_EXPENSE_WARNING_THRESHOLD_KEY,
  TEAM_EXPENSE_WARNING_THRESHOLD_DEFAULT,
} from '../../lib/queries/settings'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import { fmt, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE, MISC_CATEGORY_KEY } from '../../lib/supervisorProjectExpenseCategories'

const PROJECT_STORAGE_KEY = 'lis.expenses.lastProject'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function loadStoredProject(): string {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return ''
    const { projectId, date } = JSON.parse(raw) as { projectId: string; date: string }
    return date === todayStr() ? projectId : ''
  } catch {
    return ''
  }
}
function storeProject(projectId: string) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ projectId, date: todayStr() }))
}

function categoryField(
  c: (typeof FIXED_EXPENSE_CATEGORIES)[number],
  amounts: Record<string, string>,
  setAmounts: (fn: (a: Record<string, string>) => Record<string, string>) => void,
  t: (text: string) => string
) {
  return (
    <div className="field" key={c.key}>
      <label>{t(c.label)}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="₹"
        value={amounts[c.key] ?? ''}
        onChange={(e) => setAmounts((a) => ({ ...a, [c.key]: e.target.value }))}
      />
    </div>
  )
}

// Mirrors LIS_Fields' ExpensesPage form for a Supervisor: a fixed set of
// category amount fields (fill in whichever apply for the day), Labor
// entered as headcount × rate, one shared comment — submitting creates one
// expense record per filled category, not just one. These are claims, not
// payments: no account or receipt to pick here — the Supervisor just
// reports what was spent, and an Admin/CXO decides how it's actually
// funded (Cash/Bank/Site Imprest/Reimburse) when they approve it, at which
// point it becomes a real record.
//
// "Request Advance" lives in this same form as its own group — filling it
// in and submitting also creates a Site Imprest advance request alongside
// any claim entries, in one click. It only ever lands as 'pending' (the
// guard trigger on staff_imprest_transactions forces that for anyone but
// an Admin/CXO); an Admin still has to approve it (HR → Imprest) before
// it's a real advance posted to the ledger.
export function SupervisorProjectExpenseForm({
  actingAsProfileId,
}: {
  /** Set by the Admin/CXO "Supervisor" page — when present, every entry
   * this form creates is tagged to this supervisor's id instead of the
   * signed-in Admin/CXO, and "my workers"/"my pending requests" below
   * resolve to that supervisor's own, not the signed-in user's. */
  actingAsProfileId?: string
} = {}) {
  const { profile } = useAuth()
  const t = useT()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: staff } = useStaff()
  const { data: imprestTransactions } = useStaffImprestTransactions()
  const { data: appSettings } = useAppSettings()
  const createExpense = useCreateExpense()
  const createImprestRequest = useCreateStaffImprestTransaction()

  const targetProfileId = actingAsProfileId ?? profile?.id

  const teamExpenseWarningThreshold =
    appSettings?.get(TEAM_EXPENSE_WARNING_THRESHOLD_KEY) ?? TEAM_EXPENSE_WARNING_THRESHOLD_DEFAULT

  const activeProjects = projects?.filter((p) => p.status === 'active')
  const categoryByKey = new Map(FIXED_EXPENSE_CATEGORIES.map((c) => [c.key, c]))
  const myWorkers = (staff ?? [])
    .filter((s) => s.supervisor_id === targetProfileId && !s.end_date)
    .sort((a, b) => a.name.localeCompare(b.name))

  const [date, setDate] = useState(todayStr())
  const [projectId, setProjectId] = useState(() => loadStoredProject())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [laborQty, setLaborQty] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [comments, setComments] = useState('')
  const [teamComments, setTeamComments] = useState('')
  const [requestRows, setRequestRows] = useState<{ staffId: string; amount: string }[]>([{ staffId: '', amount: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedIds, setLastCreatedIds] = useState<string[]>([])
  const [showTeamWarning, setShowTeamWarning] = useState(false)

  const myPendingRequests = (imprestTransactions ?? [])
    .filter((t) => t.profile_id === targetProfileId && t.kind === 'advance' && t.status === 'pending')
    .sort((a, b) => b.date.localeCompare(a.date))

  const laborTotal = (Number(laborQty) || 0) * (Number(laborRate) || 0)
  const filledCategories = FIXED_EXPENSE_CATEGORIES.filter((c) => Number(amounts[c.key]) > 0)
  const miscFilled = Number(amounts[MISC_CATEGORY_KEY]) > 0
  const commentsMissing = miscFilled && !comments.trim()
  const teamTotal = (Number(amounts.food) || 0) + (Number(amounts.transport) || 0)
  const teamFilled = teamTotal > 0
  const teamCommentsMissing = teamFilled && !teamComments.trim()
  const teamOverThreshold = teamTotal > teamExpenseWarningThreshold
  const entryCount = filledCategories.length + (laborTotal > 0 ? 1 : 0)
  const claimsTotal = laborTotal + filledCategories.reduce((s, c) => s + Number(amounts[c.key]), 0)
  const filledRequestRows = requestRows.filter((r) => Number(r.amount) > 0)
  const requestFilled = filledRequestRows.length > 0
  const requestTotal = filledRequestRows.reduce((s, r) => s + Number(r.amount), 0)
  const requestMissingWorker = filledRequestRows.some((r) => !r.staffId)

  function handleProjectChange(id: string) {
    setProjectId(id)
    storeProject(id)
  }

  function resetForm() {
    setAmounts({})
    setLaborQty('')
    setLaborRate('')
    setComments('')
    setTeamComments('')
    setRequestRows([{ staffId: '', amount: '' }])
    setDate(todayStr())
    // projectId deliberately not reset — stays the default for the rest of the day
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (entryCount === 0 && !requestFilled) {
      setFormError(t('Enter an amount in at least one category, or a Request Advance amount.'))
      return
    }
    if (entryCount > 0 && !projectId) {
      setFormError(t('Pick a project.'))
      return
    }
    if (commentsMissing) {
      setFormError(t('Comments are required when Miscellaneous has an amount.'))
      return
    }
    if (teamCommentsMissing) {
      setFormError(t('Comments are required for Food/Transport entries.'))
      return
    }
    if (requestMissingWorker) {
      setFormError(t('Pick a worker for each advance request.'))
      return
    }

    if (teamOverThreshold) {
      setShowTeamWarning(true)
      return
    }
    void doSubmit()
  }

  async function doSubmit() {
    if (!targetProfileId) return
    setShowTeamWarning(false)
    setSubmitting(true)
    try {
      const entries: { subHeadCode: string; amount: number; description: string }[] = []
      if (laborTotal > 0) {
        // Deliberately not translated: this becomes the expense's stored
      // description, which an Admin/CXO (always English) reviews later.
      const laborNote = `${laborQty || 0} workers × ₹${laborRate || 0}`
        entries.push({
          subHeadCode: LABOUR_SUB_HEAD_CODE,
          amount: laborTotal,
          description: comments.trim() ? `${laborNote} — ${comments.trim()}` : laborNote,
        })
      }
      for (const c of filledCategories) {
        const isTeamExpense = c.key === 'food' || c.key === 'transport'
        const description = isTeamExpense ? teamComments.trim() : comments.trim() || c.label
        entries.push({ subHeadCode: c.subHeadCode, amount: Number(amounts[c.key]), description })
      }

      const created = await Promise.all(
        entries.map((entry) => {
          const subHead = subHeads?.find((s) => s.code === entry.subHeadCode)
          return createExpense.mutateAsync({
            description: entry.description,
            cost_center: 'Project',
            project_id: projectId,
            sub_head_id: subHead?.id ?? null,
            amount: entry.amount,
            date,
            reimbursable: false,
            receipt_path: null,
            ...(actingAsProfileId ? { created_by: actingAsProfileId } : {}),
          })
        })
      )

      if (requestFilled) {
        await Promise.all(
          filledRequestRows.map((r) =>
            createImprestRequest.mutateAsync({
              profile_id: targetProfileId,
              date,
              kind: 'advance',
              amount: Number(r.amount),
              staff_id: r.staffId,
              bank_account_id: null,
              remarks: null,
            })
          )
        )
      }

      setLastCreatedIds(created.map((c) => c.display_id).filter((id): id is string => !!id))
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, t('Could not submit.')))
    } finally {
      setSubmitting(false)
    }
  }

  const submitParts = [
    entryCount > 0 ? `${entryCount} ${entryCount === 1 ? t('entry') : t('entries')} (${fmt(claimsTotal)})` : null,
    requestFilled
      ? `${filledRequestRows.length} ${filledRequestRows.length === 1 ? t('advance request') : t('advance requests')} (${fmt(requestTotal)})`
      : null,
  ].filter((s): s is string => !!s)
  const submitLabel =
    submitting ? t('Submitting…') : submitParts.length > 0 ? `${t('Submit')} ${submitParts.join(' + ')}` : t('Submit')

  return (
    <details className="toggle-section exp-compact-section" open>
      <summary style={{ fontSize: 13 }}>{t('Add transaction')}</summary>

      <form className="form-grid exp-compact" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
        <div className="field-row">
          <div className="field field-narrow">
            <label>{t('Date')}</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('Project')}</label>
            <SearchableSelect
              items={activeProjects}
              value={projectId}
              onChange={handleProjectChange}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder={t('— Select project —')}
            />
          </div>
        </div>

        <div className="field full">
          <div className="field-row">
            {categoryField(categoryByKey.get('petrol')!, amounts, setAmounts, t)}
            {categoryField(categoryByKey.get('tools')!, amounts, setAmounts, t)}
          </div>
        </div>

        <div className="field full">
          <div className="field-row">
            {categoryField(categoryByKey.get('misc')!, amounts, setAmounts, t)}
            <div className="field">
              <label>
                {t('Description')}
                {miscFilled ? ` (${t('required for Miscellaneous')})` : ` (${t('optional')})`}
              </label>
              <input type="text" required={miscFilled} value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="field full">
          <label>{t('Man Power (Labour)')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={t('Quantity')}
              aria-label={t('Number of workers')}
              value={laborQty}
              onChange={(e) => setLaborQty(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span className="note" style={{ margin: 0 }}>
              ×
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t('Rate ₹/worker')}
              aria-label={t('Rate per worker')}
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span className="note" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              = {fmt(laborTotal)}
            </span>
          </div>
        </div>

        <details className="toggle-section" style={{ gridColumn: '1 / -1' }}>
          <summary>{t('Request Advance')}</summary>
          <div className="note" style={{ marginTop: 8, marginBottom: 8 }}>
            {t(
              'Asking an Admin for cash for one or more of your workers — each becomes a salary advance for that worker once approved, recovered from their pay later.'
            )}
          </div>

          {requestRows.map((row, i) => (
            <div className="field-row" key={i} style={{ alignItems: 'flex-end' }}>
              <div className="field">
                <label>{t('Worker')}</label>
                <SearchableSelect
                  items={myWorkers}
                  value={row.staffId}
                  onChange={(v) => setRequestRows((rows) => rows.map((r, j) => (j === i ? { ...r, staffId: v } : r)))}
                  getId={(s) => s.id}
                  getLabel={(s) => s.name}
                  placeholder={t('— Select worker —')}
                />
              </div>
              <div className="field">
                <label>{t('Amount (₹)')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="₹"
                  value={row.amount}
                  onChange={(e) =>
                    setRequestRows((rows) => rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))
                  }
                />
              </div>
              {requestRows.length > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="icon-btn-sq"
                  onClick={() => setRequestRows((rows) => rows.filter((_, j) => j !== i))}
                  title={t('Remove')}
                  aria-label={t('Remove')}
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
          <div className="field full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRequestRows((rows) => [...rows, { staffId: '', amount: '' }])}
            >
              + {t('Add another worker')}
            </Button>
          </div>

          {myPendingRequests.length > 0 && (
            <>
              <div className="note" style={{ marginTop: 10, marginBottom: 4 }}>
                {t('Awaiting approval:')}
              </div>
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('Date')}</th>
                      <th>{t('Worker')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPendingRequests.map((req) => (
                      <tr key={req.id}>
                        <td>{fmtDate(req.date)}</td>
                        <td>{myWorkers.find((s) => s.id === req.staff_id)?.name ?? '—'}</td>
                        <td className="amt">{fmt(req.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </details>

        <details className="toggle-section" style={{ gridColumn: '1 / -1' }}>
          <summary>{t('Other Claims')}</summary>
          <div className="field-row" style={{ marginTop: 8 }}>
            {categoryField(categoryByKey.get('food')!, amounts, setAmounts, t)}
            {categoryField(categoryByKey.get('transport')!, amounts, setAmounts, t)}
          </div>
          <div className="field full">
            <label>
              {t('Comments')}
              {teamFilled ? ` (${t('required')})` : ` (${t('required if either has an amount')})`}
            </label>
            <input type="text" required={teamFilled} value={teamComments} onChange={(e) => setTeamComments(e.target.value)} />
          </div>
        </details>

        <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button type="submit" disabled={submitting} style={{ flex: '1 1 auto' }}>
            {submitLabel}
          </Button>
        </div>
        {lastCreatedIds.length > 0 && (
          <div className="note" style={{ gridColumn: '1 / -1' }}>
            {t('Submitted as')} {lastCreatedIds.join(', ')} — {t('awaiting approval')}
          </div>
        )}
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      {showTeamWarning && (
        <div className="modal-backdrop" onClick={() => setShowTeamWarning(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{t('High Food/Transport amount')}</strong>
              <button type="button" className="modal-close" onClick={() => setShowTeamWarning(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                {t('Food + Transport for this entry comes to')} {fmt(teamTotal)}, {t('over the usual')} ₹
                {teamExpenseWarningThreshold}. {t('Submit anyway?')}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={() => setShowTeamWarning(false)}>
                  {t('Go back')}
                </Button>
                <Button type="button" onClick={() => void doSubmit()}>
                  {t('Submit anyway')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </details>
  )
}
