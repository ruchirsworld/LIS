import { Fragment, useState } from 'react'
import { ModuleHeader, KpiCard, Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import { useProjects, useStaff, useExpenseSubHeads } from '../../lib/queries/masters'
import { useExpenses, useExpenseReimbursements, useUpdateExpense } from '../../lib/queries/expenses'
import { useStaffImprestTransactions } from '../../lib/queries/hr'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE } from '../../lib/supervisorProjectExpenseCategories'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

type ExpandedKpi = 'expenses' | 'payments' | 'pending' | 'advances' | null
type QuickPeriod = 'week' | 'month' | 'custom'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Monday through today, in UTC-space to stay timezone-agnostic.
function currentWeekRange(todayIso: string): { from: string; to: string } {
  const d = new Date(`${todayIso}T00:00:00Z`)
  const diffToMonday = (d.getUTCDay() + 6) % 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - diffToMonday)
  return { from: monday.toISOString().slice(0, 10), to: todayIso }
}

// Mirrors LIS_Fields' StaffRecordsPage — a Supervisor's own submitted
// expenses vs reimbursement payments received against them, grouped by
// date with day totals. Distinct from the Admin/CXO Reports/Expenses
// pages, which cover the whole company, not just what this one person
// logged.
export function SupervisorRecordsPage() {
  const { profile } = useAuth()
  const t = useT()
  const { data: projects } = useProjects()
  const { data: staff } = useStaff()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: allExpenses } = useExpenses(null)
  const { data: allPendingExpenses } = useExpenses(null, 'pending')
  const { data: allReimbursements } = useExpenseReimbursements()
  const { data: allImprestTransactions } = useStaffImprestTransactions()
  const updateExpense = useUpdateExpense()

  const today = todayStr()
  const [period, setPeriod] = useState<QuickPeriod>('month')
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 7)}-01`)
  const [customTo, setCustomTo] = useState(today)
  const [expanded, setExpanded] = useState<ExpandedKpi>(null)
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null)
  const [claimAmountDraft, setClaimAmountDraft] = useState('')
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<Record<string, string>>({})

  const range =
    period === 'week'
      ? currentWeekRange(today)
      : period === 'month'
        ? { from: `${today.slice(0, 7)}-01`, to: today }
        : { from: customFrom, to: customTo }
  const datesInvalid = period === 'custom' && customFrom > customTo

  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')
  const staffName = (id: string | null) => (id ? staff?.find((s) => s.id === id)?.name ?? '—' : '—')
  const inRange = (date: string) => !datesInvalid && date >= range.from && date <= range.to

  // Same category mapping the claim form itself uses, so "Category" here
  // reads as the fixed list the Supervisor actually picked from, not the
  // Chart of Accounts sub-head name behind it.
  const claimCategoryLabelByCode = new Map<string, string>([[LABOUR_SUB_HEAD_CODE, 'Labour']])
  for (const c of FIXED_EXPENSE_CATEGORIES) claimCategoryLabelByCode.set(c.subHeadCode, c.label)
  const categoryName = (subHeadId: string | null) => {
    if (!subHeadId) return '—'
    const subHead = subHeads?.find((s) => s.id === subHeadId)
    if (!subHead) return '—'
    return claimCategoryLabelByCode.get(subHead.code) ?? subHead.name
  }

  const myExpenses = (allExpenses ?? []).filter((e) => e.created_by === profile?.id)
  const myExpenseIds = new Set(myExpenses.map((e) => e.id))
  const myExpensesInRange = myExpenses.filter((e) => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date))
  const myPaymentsInRange = (allReimbursements ?? [])
    .filter((r) => myExpenseIds.has(r.expense_id) && inRange(r.date))
    .sort((a, b) => b.date.localeCompare(a.date))

  const myPendingInRange = (allPendingExpenses ?? [])
    .filter((e) => e.created_by === profile?.id && inRange(e.date))
    .sort((a, b) => b.date.localeCompare(a.date))

  // Advances the Supervisor requested and an Admin approved, each tagged to
  // one of their workers and recovered from that worker's own pay later —
  // see HR → Imprest / the Salary tab.
  const myAdvancesInRange = (allImprestTransactions ?? [])
    .filter((t) => t.profile_id === profile?.id && t.kind === 'advance' && t.status === 'approved' && inRange(t.date))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalExpenses = myExpensesInRange.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const totalReceived = myPaymentsInRange.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalPending = myPendingInRange.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const totalAdvances = myAdvancesInRange.reduce((sum, a) => sum + Number(a.amount || 0), 0)

  const pendingByDate = new Map<string, typeof myPendingInRange>()
  for (const e of myPendingInRange) {
    const list = pendingByDate.get(e.date) ?? []
    list.push(e)
    pendingByDate.set(e.date, list)
  }
  const pendingDates = [...pendingByDate.keys()].sort((a, b) => b.localeCompare(a))

  const expensesByDate = new Map<string, typeof myExpensesInRange>()
  for (const e of myExpensesInRange) {
    const list = expensesByDate.get(e.date) ?? []
    list.push(e)
    expensesByDate.set(e.date, list)
  }
  const expenseDates = [...expensesByDate.keys()].sort((a, b) => b.localeCompare(a))

  const paymentsByDate = new Map<string, typeof myPaymentsInRange>()
  for (const p of myPaymentsInRange) {
    const list = paymentsByDate.get(p.date) ?? []
    list.push(p)
    paymentsByDate.set(p.date, list)
  }
  const paymentDates = [...paymentsByDate.keys()].sort((a, b) => b.localeCompare(a))

  const advancesByWorker = new Map<string, typeof myAdvancesInRange>()
  for (const a of myAdvancesInRange) {
    const key = a.staff_id ?? ''
    const list = advancesByWorker.get(key) ?? []
    list.push(a)
    advancesByWorker.set(key, list)
  }
  const advanceWorkerIds = [...advancesByWorker.keys()].sort((a, b) => staffName(a).localeCompare(staffName(b)))

  function toggle(kpi: ExpandedKpi) {
    setExpanded((cur) => (cur === kpi ? null : kpi))
  }

  // A Supervisor can only ever edit their own claim's amount while it's
  // still pending — once an Admin/CXO approves it, this panel doesn't show
  // it anymore (myPendingInRange only ever holds pending rows), so there's
  // no path to editing it after the fact from here.
  function startEditClaim(id: string, currentAmount: number) {
    setEditingClaimId(id)
    setClaimAmountDraft(String(currentAmount))
    setClaimError((m) => ({ ...m, [id]: '' }))
  }

  async function handleSaveClaim(id: string) {
    const amt = parseINR(claimAmountDraft)
    if (amt <= 0) {
      setClaimError((m) => ({ ...m, [id]: t('Enter an amount.') }))
      return
    }
    setClaimBusyId(id)
    setClaimError((m) => ({ ...m, [id]: '' }))
    try {
      await updateExpense.mutateAsync({ id, patch: { amount: amt } })
      setEditingClaimId(null)
    } catch (err) {
      setClaimError((m) => ({ ...m, [id]: getErrorMessage(err, t('Could not save this change.')) }))
    } finally {
      setClaimBusyId(null)
    }
  }

  return (
    <div>
      <ModuleHeader>{t('Records')}</ModuleHeader>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="pay-btn"
              style={period === p ? { background: 'var(--accent)', color: '#fff' } : undefined}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? t('This week') : p === 'month' ? t('This month') : t('Custom')}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <>
            <div className="field field-narrow">
              <label>{t('From')}</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="field field-narrow">
              <label>{t('To')}</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {datesInvalid && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          "{t('From')}" {t('must be on or before')} "{t('To')}".
        </div>
      )}

      <div className="dash-grid">
        <KpiCard
          label={t('Claims Approved')}
          value={fmt(totalExpenses)}
          onClick={() => toggle('expenses')}
          active={expanded === 'expenses'}
        />
        <KpiCard
          label={t('Claims Pending')}
          value={fmt(totalPending)}
          onClick={() => toggle('pending')}
          active={expanded === 'pending'}
        />
        <KpiCard
          label={t('Payment Received')}
          value={fmt(totalReceived)}
          onClick={() => toggle('payments')}
          active={expanded === 'payments'}
        />
        <KpiCard
          label={t('Advance received for workers')}
          value={fmt(totalAdvances)}
          onClick={() => toggle('advances')}
          active={expanded === 'advances'}
        />
      </div>

      {expanded === 'expenses' && (
        <div style={{ marginTop: 16 }}>
          {expenseDates.map((d, i) => {
            const dayExpenses = expensesByDate.get(d)!
            const dayTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
            return (
              <details key={d} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>{fmtDate(d)} — {fmt(dayTotal)}</summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Project')}</th>
                        <th>{t('Description')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map((e) => (
                        <tr key={e.id}>
                          <td>{projectName(e.project_id)}</td>
                          <td>{e.description}</td>
                          <td className="amt">{fmt(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
          {expenseDates.length === 0 && <div className="note">{t('No expenses in this range.')}</div>}
        </div>
      )}

      {expanded === 'pending' && (
        <div style={{ marginTop: 16 }}>
          {pendingDates.map((d, i) => {
            const dayPending = pendingByDate.get(d)!
            const dayTotal = dayPending.reduce((sum, e) => sum + Number(e.amount || 0), 0)
            return (
              <details key={d} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>{fmtDate(d)} — {fmt(dayTotal)}</summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Category')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayPending.map((e) =>
                        editingClaimId === e.id ? (
                          <Fragment key={e.id}>
                            <tr>
                              <td>{t(categoryName(e.sub_head_id))}</td>
                              <td>
                                <CurrencyInput value={claimAmountDraft} onValueChange={setClaimAmountDraft} />
                              </td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={3}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <Button type="button" disabled={claimBusyId === e.id} onClick={() => handleSaveClaim(e.id)}>
                                    {t('Save')}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={claimBusyId === e.id}
                                    onClick={() => setEditingClaimId(null)}
                                  >
                                    {t('Cancel')}
                                  </Button>
                                </div>
                                {claimError[e.id] && (
                                  <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                                    {claimError[e.id]}
                                  </div>
                                )}
                              </td>
                            </tr>
                          </Fragment>
                        ) : (
                          <tr key={e.id}>
                            <td>{t(categoryName(e.sub_head_id))}</td>
                            <td className="amt">{fmt(e.amount)}</td>
                            <td>
                              <Button
                                type="button"
                                variant="secondary"
                                className="icon-btn-sq"
                                onClick={() => startEditClaim(e.id, e.amount)}
                                title="Edit"
                                aria-label="Edit"
                              >
                                ✎
                              </Button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
          {pendingDates.length === 0 && <div className="note">{t('Nothing awaiting approval.')}</div>}
        </div>
      )}

      {expanded === 'payments' && (
        <div style={{ marginTop: 16 }}>
          {paymentDates.map((d, i) => {
            const dayTotal = paymentsByDate.get(d)!.reduce((sum, p) => sum + Number(p.amount || 0), 0)
            return (
              <details key={d} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>{fmtDate(d)} — {fmt(dayTotal)}</summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Reference')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsByDate.get(d)!.map((p) => (
                        <tr key={p.id}>
                          <td>{p.reference || '—'}</td>
                          <td className="amt">{fmt(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
          {paymentDates.length === 0 && <div className="note">{t('No payments in this range.')}</div>}
        </div>
      )}

      {expanded === 'advances' && (
        <div style={{ marginTop: 16 }}>
          {advanceWorkerIds.map((workerId, i) => {
            const workerAdvances = advancesByWorker.get(workerId)!
            const workerTotal = workerAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0)
            return (
              <details key={workerId || '—'} className="toggle-section" style={{ marginBottom: 10 }} open={i === 0}>
                <summary>
                  {staffName(workerId || null)} — {fmt(workerTotal)}
                </summary>
                <div className="table-scroll" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('Date')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerAdvances.map((a) => (
                        <tr key={a.id}>
                          <td>{fmtDate(a.date)}</td>
                          <td className="amt">{fmt(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
          {advanceWorkerIds.length === 0 && <div className="note">{t('No advances in this range.')}</div>}
        </div>
      )}
    </div>
  )
}
