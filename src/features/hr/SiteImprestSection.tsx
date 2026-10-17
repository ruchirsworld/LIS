import { confirmAction } from '../../lib/feedback'
import { Fragment, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts, useStaff } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useLedgerLines } from '../../lib/queries/ledger'
import { useExpenses } from '../../lib/queries/expenses'
import {
  useStaffImprestTransactions,
  useCreateStaffImprestTransaction,
  useUpdateStaffImprestTransaction,
  useDeleteStaffImprestTransaction,
} from '../../lib/queries/hr'
import { ReportPeriodFilter } from '../reports/ReportPeriodFilter'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadImprestImportTemplate } from '../../lib/import/imprestTemplate'
import { parseImprestImport, commitImprestImport } from '../../lib/import/runImprestImport'
import { useAuth } from '../../lib/auth'
import {
  PaymentAccountPicker,
  bankAccountIdOf,
  CASH_ACCOUNT,
  REIMBURSE_ACCOUNT as REIMBURSE_ID,
} from '../../components/PaymentAccountPicker'
import type { ExportSection } from '../../lib/export/report'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type StaffImprestTransaction = Database['public']['Tables']['staff_imprest_transactions']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// A Supervisor's site float — money handed over to spend on Food/Fuel/Tools
// etc. at the site. Not owed back; it's meant to be spent, and clears as the
// Supervisor's own Project expenses draw against it (see the "Advance"
// account option on their expense form). Distinct from a Salary Advance,
// which is a personal loan against wages — see the Salary tab for that.
export function SiteImprestSection() {
  const { profile } = useAuth()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'
  // Deleting a transaction un-posts its GL entry entirely — a heavier
  // action than editing, so it's Admin-only, unlike everything else here.
  const canDelete = profile?.role === 'admin'
  const { data: profiles } = useProfiles()
  const { data: bankAccounts } = useBankAccounts()
  const { data: staff } = useStaff()
  const { data: allTransactionsRaw } = useStaffImprestTransactions()
  const { data: pendingClaimsRaw } = useExpenses(null, 'pending')
  const { data: approvedClaimsRaw } = useExpenses(null, 'approved')
  const createTransaction = useCreateStaffImprestTransaction()
  const updateTransaction = useUpdateStaffImprestTransaction()
  const deleteTransaction = useDeleteStaffImprestTransaction()

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  const staffName = (id: string | null) => (id ? staff?.find((s) => s.id === id)?.name ?? '—' : null)

  // A Supervisor-requested advance sits at status 'pending' until an Admin
  // approves it below — it isn't real money yet, so every balance/list on
  // this page (besides the approval queue itself) only ever looks at
  // 'approved' rows, same as the GL only posts those. A worker-tagged
  // advance (staff_id set) posts as a Salary Advance instead of Site
  // Imprest once approved, and shows up on the Salary tab instead — so it's
  // excluded here.
  const allTransactions = (allTransactionsRaw ?? []).filter(
    (t) => t.status === 'approved' && !(t.staff_id && t.kind === 'advance')
  )
  const pendingRequests = (allTransactionsRaw ?? [])
    .filter((t) => t.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

  const [supervisorId, setSupervisorId] = useState('')
  const [kind, setKind] = useState<'advance' | 'return'>('advance')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [bankAccountId, setBankAccountId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [paymentsRange, setPaymentsRange] = useState<DateRange | null>(null)
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<Record<string, string>>({})
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [requestDraft, setRequestDraft] = useState({ date: '', amount: '', staffId: '' })
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null)
  const [txnDraft, setTxnDraft] = useState({
    date: '',
    kind: 'advance' as 'advance' | 'return',
    amount: '',
    bankAccountId: '',
  })
  const [txnBusyId, setTxnBusyId] = useState<string | null>(null)
  const [txnError, setTxnError] = useState<Record<string, string>>({})

  // "Float currently held" still needs the full GL picture (advances minus
  // whatever their own Project expenses have drawn against it) to be
  // accurate — only the table below is narrowed to just the payments made.
  const { data: ledgerLines, isLoading: ledgerLoading } = useLedgerLines('1060', 'profile_id', supervisorId || null)
  const currentFloat = (ledgerLines ?? []).reduce((s, l) => s + l.debit - l.credit, 0)

  // "Imprest payments" means money actually paid out (advances) — a return
  // is the opposite direction and stays out of this list, same as it did
  // when this was first narrowed down from the full mixed ledger.
  const supervisorPayments = (allTransactions ?? [])
    .filter(
      (t) =>
        t.profile_id === supervisorId &&
        t.kind === 'advance' &&
        (!paymentsRange?.from || t.date >= paymentsRange.from) &&
        (!paymentsRange?.to || t.date <= paymentsRange.to)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))

  // Same supervisor, same date range, but every kind — advances and returns
  // both — this is now the sole view shown in "Imprest payment records".
  const recordsShown = (allTransactions ?? [])
    .filter(
      (t) =>
        t.profile_id === supervisorId &&
        (!paymentsRange?.from || t.date >= paymentsRange.from) &&
        (!paymentsRange?.to || t.date <= paymentsRange.to)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))

  const supervisorName = (id: string) => supervisors.find((p) => p.id === id)?.name ?? '—'
  const bankAccountName = (id: string | null) => (id ? bankAccounts?.find((a) => a.id === id)?.name ?? '—' : 'Cash')
  const accountLabel = (t: StaffImprestTransaction) => (t.reimbursable ? 'Reimbursement' : bankAccountName(t.bank_account_id))

  const recordsExportSections: ExportSection[] = [
    {
      title: `${supervisorName(supervisorId)} — Imprest transactions`,
      columns: ['Date', 'Type', 'Amount', 'Account'],
      rows: recordsShown.map((t) => [fmtDate(t.date), t.kind === 'advance' ? 'Advance' : 'Return', t.amount, accountLabel(t)]),
    },
  ]

  // Same "claims" this Supervisor's Project cost-center expenses represent
  // elsewhere (Approvals, Records) — same filter PendingClaimApprovals.tsx
  // uses. Deliberately all-time, not scoped to the period filter below:
  // "Claims Pending" is a queue depth (what's outstanding right now), and
  // "Claims — Payments" next to the heading is a running health check, not
  // an activity total for a window.
  const supervisorPendingClaims = (pendingClaimsRaw ?? [])
    .filter((e) => e.cost_center === 'Project' && e.created_by === supervisorId)
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalClaimsPending = supervisorPendingClaims.reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalClaimsApproved = (approvedClaimsRaw ?? [])
    .filter((e) => e.cost_center === 'Project' && e.created_by === supervisorId)
    .reduce((s, e) => s + Number(e.amount || 0), 0)
  const allTimePaymentsMade = (allTransactions ?? [])
    .filter((t) => t.profile_id === supervisorId && t.kind === 'advance')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const claimsMinusPayments = totalClaimsApproved - allTimePaymentsMade

  async function handleApproveRequest(id: string) {
    setRequestBusyId(id)
    setRequestError((m) => ({ ...m, [id]: '' }))
    try {
      await updateTransaction.mutateAsync({ id, patch: { status: 'approved' } })
    } catch (err) {
      setRequestError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not approve this request.') }))
    } finally {
      setRequestBusyId(null)
    }
  }

  async function handleRejectRequest(id: string) {
    setRequestBusyId(id)
    setRequestError((m) => ({ ...m, [id]: '' }))
    try {
      await updateTransaction.mutateAsync({ id, patch: { status: 'rejected' } })
    } catch (err) {
      setRequestError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not reject this request.') }))
    } finally {
      setRequestBusyId(null)
    }
  }

  function startEditRequest(t: StaffImprestTransaction) {
    setEditingRequestId(t.id)
    setRequestDraft({ date: t.date, amount: String(t.amount), staffId: t.staff_id ?? '' })
    setRequestError((m) => ({ ...m, [t.id]: '' }))
  }

  async function handleSaveRequest(id: string) {
    const amt = parseINR(requestDraft.amount)
    if (amt <= 0) {
      setRequestError((m) => ({ ...m, [id]: 'Enter an amount.' }))
      return
    }
    if (!requestDraft.date) {
      setRequestError((m) => ({ ...m, [id]: 'Date is required.' }))
      return
    }
    if (!requestDraft.staffId) {
      setRequestError((m) => ({ ...m, [id]: 'Pick a worker.' }))
      return
    }
    setRequestBusyId(id)
    setRequestError((m) => ({ ...m, [id]: '' }))
    try {
      await updateTransaction.mutateAsync({
        id,
        patch: { date: requestDraft.date, amount: amt, staff_id: requestDraft.staffId },
      })
      setEditingRequestId(null)
    } catch (err) {
      setRequestError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not save these changes.') }))
    } finally {
      setRequestBusyId(null)
    }
  }

  function startEditTxn(t: StaffImprestTransaction) {
    setEditingTxnId(t.id)
    setTxnDraft({
      date: t.date,
      kind: t.kind as 'advance' | 'return',
      amount: String(t.amount),
      bankAccountId: t.reimbursable ? REIMBURSE_ID : t.bank_account_id ?? CASH_ACCOUNT,
    })
    setTxnError((m) => ({ ...m, [t.id]: '' }))
  }

  async function handleSaveTxn(id: string) {
    const amt = parseINR(txnDraft.amount)
    if (amt <= 0) {
      setTxnError((m) => ({ ...m, [id]: 'Enter an amount.' }))
      return
    }
    if (!txnDraft.date) {
      setTxnError((m) => ({ ...m, [id]: 'Date is required.' }))
      return
    }
    setTxnBusyId(id)
    setTxnError((m) => ({ ...m, [id]: '' }))
    try {
      await updateTransaction.mutateAsync({
        id,
        patch: {
          date: txnDraft.date,
          kind: txnDraft.kind,
          amount: amt,
          bank_account_id: bankAccountIdOf(txnDraft.bankAccountId),
          reimbursable: txnDraft.bankAccountId === REIMBURSE_ID,
        },
      })
      setEditingTxnId(null)
    } catch (err) {
      setTxnError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not save these changes.') }))
    } finally {
      setTxnBusyId(null)
    }
  }

  async function handleDeleteTxn(t: StaffImprestTransaction) {
    const kindLabel = t.kind === 'advance' ? 'advance' : 'return'
    const ok = await confirmAction({
      title: `Delete ${kindLabel}`,
      message: `Delete this ${kindLabel} of ${fmt(t.amount)} dated ${fmtDate(t.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setTxnBusyId(t.id)
    setTxnError((m) => ({ ...m, [t.id]: '' }))
    try {
      await deleteTransaction.mutateAsync(t.id)
    } catch (err) {
      setTxnError((m) => ({ ...m, [t.id]: getErrorMessage(err, 'Could not delete this transaction.') }))
    } finally {
      setTxnBusyId(null)
    }
  }

  async function handleDeleteRequest(t: StaffImprestTransaction) {
    const ok = await confirmAction({
      title: 'Delete request',
      message: `Delete this pending request for ${fmt(t.amount)} dated ${fmtDate(t.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setRequestBusyId(t.id)
    setRequestError((m) => ({ ...m, [t.id]: '' }))
    try {
      await deleteTransaction.mutateAsync(t.id)
    } catch (err) {
      setRequestError((m) => ({ ...m, [t.id]: getErrorMessage(err, 'Could not delete this request.') }))
    } finally {
      setRequestBusyId(null)
    }
  }

  function resetForm() {
    setKind('advance')
    setDate(todayStr())
    setAmount('0')
    setBankAccountId('')
    setRemarks('')
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supervisorId) {
      setFormError('Pick a supervisor.')
      return
    }
    const amt = parseINR(amount)
    if (amt <= 0) {
      setFormError('Enter an amount.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await createTransaction.mutateAsync({
        profile_id: supervisorId,
        date,
        kind,
        amount: amt,
        bank_account_id: bankAccountIdOf(bankAccountId),
        reimbursable: bankAccountId === REIMBURSE_ID,
        remarks: remarks.trim() || null,
      })
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not record this transaction.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {pendingRequests.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 13 }}>Pending advance requests</h3>
          <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
            Requested by a Supervisor from their own screen, for one of their workers — approving records it as a
            salary advance for that worker, recovered from their pay later.
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Supervisor</th>
                  <th>Date</th>
                  <th>Worker</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((t) =>
                  editingRequestId === t.id ? (
                    <Fragment key={t.id}>
                      <tr>
                        <td>{supervisorName(t.profile_id)}</td>
                        <td>
                          <input
                            type="date"
                            aria-label="Date"
                            value={requestDraft.date}
                            onChange={(e) => setRequestDraft((d) => ({ ...d, date: e.target.value }))}
                          />
                        </td>
                        <td>
                          <SearchableSelect
                            items={(staff ?? []).filter((s) => s.supervisor_id === t.profile_id)}
                            value={requestDraft.staffId}
                            onChange={(v) => setRequestDraft((d) => ({ ...d, staffId: v }))}
                            getId={(s) => s.id}
                            getLabel={(s) => s.name}
                            placeholder="— Select worker —"
                          />
                        </td>
                        <td>
                          <CurrencyInput
                            value={requestDraft.amount}
                            onValueChange={(v) => setRequestDraft((d) => ({ ...d, amount: v }))}
                          />
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={5}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button type="button" disabled={requestBusyId === t.id} onClick={() => handleSaveRequest(t.id)}>
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={requestBusyId === t.id}
                              onClick={() => setEditingRequestId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                          {requestError[t.id] && (
                            <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                              {requestError[t.id]}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  ) : (
                    <tr key={t.id}>
                      <td>{supervisorName(t.profile_id)}</td>
                      <td>{fmtDate(t.date)}</td>
                      <td>{staffName(t.staff_id) ?? '—'}</td>
                      <td className="amt">{fmt(t.amount)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Button
                            type="button"
                            className="icon-btn-sq"
                            disabled={requestBusyId === t.id}
                            onClick={() => handleApproveRequest(t.id)}
                            title="Approve"
                            aria-label="Approve"
                          >
                            ✓
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="icon-btn-sq"
                            disabled={requestBusyId === t.id}
                            onClick={() => handleRejectRequest(t.id)}
                            title="Reject"
                            aria-label="Reject"
                          >
                            ✕
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="icon-btn-sq"
                            disabled={requestBusyId === t.id}
                            onClick={() => startEditRequest(t)}
                            title="Edit"
                            aria-label="Edit"
                          >
                            ✎
                          </Button>
                          {canDelete && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="icon-btn-sq"
                              disabled={requestBusyId === t.id}
                              onClick={() => handleDeleteRequest(t)}
                              title="Delete"
                              aria-label="Delete"
                            >
                              🗑
                            </Button>
                          )}
                        </div>
                        {requestError[t.id] && (
                          <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                            {requestError[t.id]}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Imprest</h3>
        <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
          Cash handed to a Supervisor for site spending — cleared as their own Project expenses draw against it, not
          repaid like a loan.
        </div>

        <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
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
          <div className="note">Pick a supervisor to see their float and record a transaction.</div>
        ) : (
          <>
            <div className="dash-grid" style={{ marginBottom: 16 }}>
              <div className="dash-card">
                <div className="dash-label">Balance</div>
                <div className="dash-value" style={ledgerLoading ? undefined : { color: currentFloat < 0 ? 'var(--red)' : 'var(--blue)' }}>
                  {ledgerLoading ? '—' : fmt(currentFloat)}
                </div>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 0 }}>
              <div className="field full">
                <label>Type</label>
                <div className="pill-tabs">
                  <button type="button" className={kind === 'advance' ? 'pill active' : 'pill'} onClick={() => setKind('advance')}>
                    Give advance
                  </button>
                  <button
                    type="button"
                    className={kind === 'return' ? 'pill active' : 'pill'}
                    onClick={() => {
                      setKind('return')
                      setBankAccountId((id) => (id === REIMBURSE_ID ? '' : id))
                    }}
                  >
                    Record return
                  </button>
                </div>
              </div>
              <div className="field field-narrow">
                <label>Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <CurrencyInput value={amount} onValueChange={setAmount} required />
              </div>
              <div className="field full">
                <PaymentAccountPicker
                  style={{ padding: 0 }}
                  label={kind === 'return' ? 'Receiving account' : 'Payment account'}
                  value={bankAccountId}
                  onChange={setBankAccountId}
                  allowReimbursement={kind === 'advance'}
                />
                {bankAccountId === REIMBURSE_ID && (
                  <div className="note" style={{ marginTop: 4 }}>
                    Paid by the Admin/CXO out of pocket — no cash/bank moves; the firm owes it back to them.
                  </div>
                )}
              </div>

              <div className="field full">
                <label>Remarks (optional)</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <div className="field full">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : kind === 'advance' ? 'Give advance' : 'Record return'}
                </Button>
              </div>
            </form>
            {formError && (
              <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h4 style={{ marginBottom: 10 }}>Imprest payment records</h4>
              <div className="note" style={{ margin: 0 }}>
                CLAIMS - PAYMENTS:{' '}
                <strong style={{ color: allTimePaymentsMade > totalClaimsApproved ? 'var(--blue)' : 'var(--red)' }}>
                  {fmt(claimsMinusPayments)}
                </strong>
              </div>
            </div>
            <div className="dash-grid" style={{ marginBottom: 16 }}>
              <div className="dash-card">
                <div className="dash-label">Payments made</div>
                <div className="dash-value">{fmt(supervisorPayments.reduce((s, t) => s + Number(t.amount), 0))}</div>
                <div className="note" style={{ margin: 0 }}>{supervisorPayments.length} record(s)</div>
              </div>
              <div className="dash-card">
                <div className="dash-label">Claims Pending</div>
                <div className="dash-value">{fmt(totalClaimsPending)}</div>
                <div className="note" style={{ margin: 0 }}>{supervisorPendingClaims.length} record(s)</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <ReportPeriodFilter onChange={(r) => setPaymentsRange(r)} />
              <ReportExportButtons
                title={`${supervisorName(supervisorId)} — Imprest transactions`}
                sections={recordsExportSections}
                range={paymentsRange}
                iconOnly
              />
            </div>

            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Account</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recordsShown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        No transactions recorded yet
                      </td>
                    </tr>
                  )}
                  {recordsShown.map((t) =>
                    editingTxnId === t.id ? (
                      <Fragment key={t.id}>
                        <tr>
                          <td>
                            <input
                              type="date"
                              aria-label="Date"
                              value={txnDraft.date}
                              onChange={(e) => setTxnDraft((d) => ({ ...d, date: e.target.value }))}
                            />
                          </td>
                          <td>
                            <select
                              aria-label="Type"
                              value={txnDraft.kind}
                              onChange={(e) => {
                                const k = e.target.value as 'advance' | 'return'
                                setTxnDraft((d) => ({
                                  ...d,
                                  kind: k,
                                  bankAccountId: k === 'return' && d.bankAccountId === REIMBURSE_ID ? '' : d.bankAccountId,
                                }))
                              }}
                            >
                              <option value="advance">Advance</option>
                              <option value="return">Return</option>
                            </select>
                          </td>
                          <td>
                            <CurrencyInput
                              value={txnDraft.amount}
                              onValueChange={(v) => setTxnDraft((d) => ({ ...d, amount: v }))}
                            />
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={5}>
                            <PaymentAccountPicker
                              style={{ marginBottom: 8 }}
                              label={txnDraft.kind === 'return' ? 'Receiving account' : 'Payment account'}
                              value={txnDraft.bankAccountId}
                              onChange={(id) => setTxnDraft((d) => ({ ...d, bankAccountId: id }))}
                              allowReimbursement={txnDraft.kind === 'advance'}
                            />

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <Button type="button" disabled={txnBusyId === t.id} onClick={() => handleSaveTxn(t.id)}>
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={txnBusyId === t.id}
                                onClick={() => setEditingTxnId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                            {txnError[t.id] && (
                              <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                                {txnError[t.id]}
                              </div>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    ) : (
                      <tr key={t.id} className={t.reimbursable ? 'row-reimb' : undefined} title={t.reimbursable ? 'Recorded as reimbursement' : undefined}>
                        <td>{fmtDate(t.date)}</td>
                        <td>{t.kind === 'advance' ? 'Advance' : 'Return'}</td>
                        <td className="amt">{fmt(t.amount)}</td>
                        <td>{accountLabel(t)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button
                              type="button"
                              variant="secondary"
                              className="icon-btn-sq"
                              onClick={() => startEditTxn(t)}
                              title="Edit"
                              aria-label="Edit"
                            >
                              ✎
                            </Button>
                            {canDelete && (
                              <Button
                                type="button"
                                variant="secondary"
                                className="icon-btn-sq"
                                disabled={txnBusyId === t.id}
                                onClick={() => handleDeleteTxn(t)}
                                title="Delete"
                                aria-label="Delete"
                              >
                                🗑
                              </Button>
                            )}
                          </div>
                          {txnError[t.id] && (
                            <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                              {txnError[t.id]}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {canImport && (
          <ImportFileBlock
            label="Bulk-add Imprest advances/returns from Excel"
            onDownload={downloadImprestImportTemplate}
            onParse={parseImprestImport}
            onCommit={commitImprestImport}
            invalidateKeys={['staff_imprest_transactions', 'ledger_lines']}
          />
        )}
      </div>
    </div>
  )
}
