import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProjects, useExpenseSubHeads } from '../../lib/queries/masters'
import { useCreateExpense } from '../../lib/queries/expenses'
import { fmt } from '../../lib/calc/format'
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

// Mirrors LIS_Fields' ExpensesPage form for a Supervisor: a fixed set of
// category amount fields (fill in whichever apply for the day), Labor
// entered as headcount × rate, one shared comment — submitting creates one
// expense record per filled category, not just one. These are claims, not
// payments: no account or receipt to pick here — the Supervisor just
// reports what was spent, and an Admin/CXO decides how it's actually
// funded (Cash/Bank/Site Imprest/Reimburse) when they approve it, at which
// point it becomes a real record.
export function SupervisorProjectExpenseForm() {
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const createExpense = useCreateExpense()

  const activeProjects = projects?.filter((p) => p.status === 'active')

  const [date, setDate] = useState(todayStr())
  const [projectId, setProjectId] = useState(() => loadStoredProject())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [laborQty, setLaborQty] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedIds, setLastCreatedIds] = useState<string[]>([])

  const laborTotal = (Number(laborQty) || 0) * (Number(laborRate) || 0)
  const filledCategories = FIXED_EXPENSE_CATEGORIES.filter((c) => Number(amounts[c.key]) > 0)
  const miscFilled = Number(amounts[MISC_CATEGORY_KEY]) > 0
  const commentsMissing = miscFilled && !comments.trim()
  const entryCount = filledCategories.length + (laborTotal > 0 ? 1 : 0)
  const totalAmount = laborTotal + filledCategories.reduce((s, c) => s + Number(amounts[c.key]), 0)

  function handleProjectChange(id: string) {
    setProjectId(id)
    storeProject(id)
  }

  function resetForm() {
    setAmounts({})
    setLaborQty('')
    setLaborRate('')
    setComments('')
    setDate(todayStr())
    // projectId deliberately not reset — stays the default for the rest of the day
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!projectId) {
      setFormError('Pick a project.')
      return
    }
    if (entryCount === 0) {
      setFormError('Enter an amount in at least one category.')
      return
    }
    if (commentsMissing) {
      setFormError('Comments are required when Miscellaneous has an amount.')
      return
    }

    setSubmitting(true)
    try {
      const entries: { subHeadCode: string; amount: number; description: string }[] = []
      if (laborTotal > 0) {
        const laborNote = `${laborQty || 0} workers × ₹${laborRate || 0}`
        entries.push({
          subHeadCode: LABOUR_SUB_HEAD_CODE,
          amount: laborTotal,
          description: comments.trim() ? `${laborNote} — ${comments.trim()}` : laborNote,
        })
      }
      for (const c of filledCategories) {
        entries.push({ subHeadCode: c.subHeadCode, amount: Number(amounts[c.key]), description: comments.trim() || c.label })
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
          })
        })
      )
      setLastCreatedIds(created.map((c) => c.display_id).filter((id): id is string => !!id))
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not submit.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section exp-compact-section" open>
      <summary style={{ fontSize: 13 }}>Add transaction</summary>

      <form className="form-grid exp-compact" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
        <div className="field-row">
          <div className="field field-narrow">
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Project</label>
            <SearchableSelect
              items={activeProjects}
              value={projectId}
              onChange={handleProjectChange}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— Select project —"
            />
          </div>
        </div>

        <div className="field full">
          <label>Men Power (Labour)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Quantity"
              aria-label="Number of workers"
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
              placeholder="Rate ₹/worker"
              aria-label="Rate per worker"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span className="note" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              = {fmt(laborTotal)}
            </span>
          </div>
        </div>

        {FIXED_EXPENSE_CATEGORIES.map((c) => (
          <div className="field" key={c.key}>
            <label>{c.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="₹"
              value={amounts[c.key] ?? ''}
              onChange={(e) => setAmounts((a) => ({ ...a, [c.key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="field full">
          <label>Comments{miscFilled ? ' (required for Miscellaneous)' : ' (optional)'}</label>
          <input type="text" required={miscFilled} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button type="submit" disabled={submitting} style={{ flex: '1 1 auto' }}>
            {submitting
              ? 'Submitting…'
              : entryCount > 0
                ? `Submit ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} — ${fmt(totalAmount)}`
                : 'Submit'}
          </Button>
        </div>
        {lastCreatedIds.length > 0 && (
          <div className="note" style={{ gridColumn: '1 / -1' }}>
            Submitted as {lastCreatedIds.join(', ')} — awaiting approval
          </div>
        )}
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
