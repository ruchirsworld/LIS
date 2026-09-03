import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useLedgerLines } from '../../lib/queries/ledger'
import { useStaffImprestTransactions, useCreateStaffImprestTransaction } from '../../lib/queries/hr'
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
  const { data: profiles } = useProfiles()
  const { data: bankAccounts } = useBankAccounts()
  const { data: allTransactions } = useStaffImprestTransactions()
  const createTransaction = useCreateStaffImprestTransaction()

  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')

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
                  </tr>
                </thead>
                <tbody>
                  {recordsShown.length === 0 && (
                    <tr>
                      <td colSpan={recordsView === 'all' ? 4 : 3} className="empty-row">
                        No {recordsView === 'payments' ? 'payments' : 'transactions'} recorded yet
                      </td>
                    </tr>
                  )}
                  {recordsShown.map((t) => (
                    <tr key={t.id}>
                      <td>{fmtDate(t.date)}</td>
                      {recordsView === 'all' && <td>{t.kind === 'advance' ? 'Advance' : 'Return'}</td>}
                      <td className="amt">{fmt(t.amount)}</td>
                      <td>{bankAccountName(t.bank_account_id)}</td>
                    </tr>
                  ))}
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
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {allTransactionsSorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No transactions recorded yet
                  </td>
                </tr>
              )}
              {allTransactionsSorted.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.date)}</td>
                  <td className="amt">{t.kind === 'advance' ? fmt(t.amount) : '—'}</td>
                  <td>{bankAccountName(t.bank_account_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
