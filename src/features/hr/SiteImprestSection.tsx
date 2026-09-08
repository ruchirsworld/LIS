import { Fragment, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts, useStaff } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useLedgerLines } from '../../lib/queries/ledger'
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
  const createTransaction = useCreateStaffImprestTransaction()
  const updateTransaction = useUpdateStaffImprestTransaction()
  const deleteTransaction = useDeleteStaffImprestTransaction()

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  const staffName = (id: string | null) => (id ? staff?.find((s) => s.id === id)?.name ?? '—' : null)

  // A Supervisor-requested advance sits at status 'pending' until an Admin
  // approves it below — it isn't real money yet, so every balance/list on
  // this page (besides the approval queue itself) only ever looks at
  // 'approved' rows, same as the GL only posts those. A request tagged with
  // a specific worker (staff_id set) posts as a Salary Advance instead of
  // Site Imprest once approved — see the Salary tab for those, not here.
  const allTransactions = (allTransactionsRaw ?? []).filter((t) => t.status === 'approved' && !t.staff_id)
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
  const [recordsView, setRecordsView] = useState<'payments' | 'all'>('payments')
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<Record<string, string>>({})
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [requestDraft, setRequestDraft] = useState({ date: '', amount: '', staffId: '' })
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null)
  const [txnDraft, setTxnDraft] = useState({ date: '', kind: 'advance' as 'advance' | 'return', amount: '', bankAccountId: '' })
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
  // both — for the "All transactions" KPI block.
  const supervisorAllTransactions = (allTransactions ?? [])
    .filter(
      (t) =>
        t.profile_id === supervisorId &&
        (!paymentsRange?.from || t.date >= paymentsRange.from) &&
        (!paymentsRange?.to || t.date <= paymentsRange.to)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))

  const recordsShown = recordsView === 'payments' ? supervisorPayments : supervisorAllTransactions

  const supervisorName = (id: string) => supervisors.find((p) => p.id === id)?.name ?? '—'
  const bankAccountName = (id: string | null) => (id ? bankAccounts?.find((a) => a.id === id)?.name ?? '—' : 'Cash')

  const recordsExportSections: ExportSection[] = [
    {
      title: `${supervisorName(supervisorId)} — Imprest ${recordsView === 'payments' ? 'payments' : 'transactions'}`,
      columns:
        recordsView === 'payments' ? ['Date', 'Amount', 'Account'] : ['Date', 'Type', 'Amount', 'Account'],
      rows:
        recordsView === 'payments'
          ? supervisorPayments.map((t) => [fmtDate(t.date), t.amount, bankAccountName(t.bank_account_id)])
          : supervisorAllTransactions.map((t) => [
              fmtDate(t.date),
              t.kind === 'advance' ? 'Advance' : 'Return',
              t.amount,
              bankAccountName(t.bank_account_id),
            ]),
    },
  ]

  const allTransactionsSorted = [...(allTransactions ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  )

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
    setTxnDraft({ date: t.date, kind: t.kind as 'advance' | 'return', amount: String(t.amount), bankAccountId: t.bank_account_id ?? '' })
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
        patch: { date: txnDraft.date, kind: txnDraft.kind, amount: amt, bank_account_id: txnDraft.bankAccountId || null },
      })
      setEditingTxnId(null)
    } catch (err) {
      setTxnError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not save these changes.') }))
    } finally {
      setTxnBusyId(null)
    }
  }

  async function handleDeleteTxn(t: StaffImprestTransaction) {
    if (!window.confirm(`Delete this ${t.kind === 'advance' ? 'advance' : 'return'} of ${fmt(t.amount)} dated ${fmtDate(t.date)}? This cannot be undone.`))
      return
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
    if (!window.confirm(`Delete this pending request for ${fmt(t.amount)} dated ${fmtDate(t.date)}? This cannot be undone.`)) return
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
        bank_account_id: bankAccountId || null,
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
                  <button type="button" className={kind === 'return' ? 'pill active' : 'pill'} onClick={() => setKind('return')}>
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
              <div className="field">
                <label>Account</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                  <option value="">Cash</option>
                  {(bankAccounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
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

            <h4 style={{ marginBottom: 10 }}>Imprest payment records</h4>
            <div className="dash-grid" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className="dash-card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: recordsView === 'payments' ? '2px solid var(--accent)' : undefined,
                }}
                onClick={() => setRecordsView('payments')}
              >
                <div className="dash-label">Payments</div>
                <div className="dash-value">{fmt(supervisorPayments.reduce((s, t) => s + Number(t.amount), 0))}</div>
                <div className="note" style={{ margin: 0 }}>{supervisorPayments.length} record(s)</div>
              </button>
              <button
                type="button"
                className="dash-card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: recordsView === 'all' ? '2px solid var(--accent)' : undefined,
                }}
                onClick={() => setRecordsView('all')}
              >
                <div className="dash-label">All transactions</div>
                <div className="dash-value">
                  {fmt(supervisorAllTransactions.reduce((s, t) => s + Number(t.amount), 0))}
                </div>
                <div className="note" style={{ margin: 0 }}>{supervisorAllTransactions.length} record(s)</div>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <ReportPeriodFilter onChange={(r) => setPaymentsRange(r)} />
              <ReportExportButtons
                title={`${supervisorName(supervisorId)} — Imprest ${recordsView === 'payments' ? 'payments' : 'transactions'}`}
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
                    {recordsView === 'all' && <th>Type</th>}
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Account</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recordsShown.length === 0 && (
                    <tr>
                      <td colSpan={recordsView === 'all' ? 5 : 4} className="empty-row">
                        No {recordsView === 'payments' ? 'payments' : 'transactions'} recorded yet
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
                          {recordsView === 'all' && (
                            <td>
                              <select
                                aria-label="Type"
                                value={txnDraft.kind}
                                onChange={(e) => setTxnDraft((d) => ({ ...d, kind: e.target.value as 'advance' | 'return' }))}
                              >
                                <option value="advance">Advance</option>
                                <option value="return">Return</option>
                              </select>
                            </td>
                          )}
                          <td>
                            <CurrencyInput
                              value={txnDraft.amount}
                              onValueChange={(v) => setTxnDraft((d) => ({ ...d, amount: v }))}
                            />
                          </td>
                          <td>
                            <select
                              aria-label="Account"
                              value={txnDraft.bankAccountId}
                              onChange={(e) => setTxnDraft((d) => ({ ...d, bankAccountId: e.target.value }))}
                            >
                              <option value="">Cash</option>
                              {(bankAccounts ?? []).map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={recordsView === 'all' ? 5 : 4}>
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
                      <tr key={t.id}>
                        <td>{fmtDate(t.date)}</td>
                        {recordsView === 'all' && <td>{t.kind === 'advance' ? 'Advance' : 'Return'}</td>}
                        <td className="amt">{fmt(t.amount)}</td>
                        <td>{bankAccountName(t.bank_account_id)}</td>
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

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>All imprest transactions</h3>
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
              {allTransactionsSorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No transactions recorded yet
                  </td>
                </tr>
              )}
              {allTransactionsSorted.map((t) =>
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
                          onChange={(e) => setTxnDraft((d) => ({ ...d, kind: e.target.value as 'advance' | 'return' }))}
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
                      <td>
                        <select
                          aria-label="Account"
                          value={txnDraft.bankAccountId}
                          onChange={(e) => setTxnDraft((d) => ({ ...d, bankAccountId: e.target.value }))}
                        >
                          <option value="">Cash</option>
                          {(bankAccounts ?? []).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={5}>
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
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.kind === 'advance' ? 'Advance' : 'Return'}</td>
                    <td className="amt">{fmt(t.amount)}</td>
                    <td>{bankAccountName(t.bank_account_id)}</td>
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
      </div>
    </div>
  )
}
