import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateLoan, useUpdateLoan } from '../../lib/queries/loans'
import { fmt2, parseINR } from '../../lib/calc/format'
import { DEFAULT_PRIVATE_LOAN_ROI, monthlyInterestOn } from '../../lib/calc/loans'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Loan = Database['public']['Tables']['loans']['Row']

const CASH = 'cash'

export function LoanForm({
  editingLoan,
  onDoneEditing,
  inModal = false,
}: {
  editingLoan: Loan | null
  onDoneEditing: () => void
  /** Shown inside a popup: without the section heading around it. */
  inModal?: boolean
}) {
  const createLoan = useCreateLoan()
  const updateLoan = useUpdateLoan()
  const { data: bankAccounts } = useBankAccounts()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(bankAccounts ?? [])]

  const [loanType, setLoanType] = useState<'private' | 'bank'>('private')
  const [lender, setLender] = useState('')
  const [principal, setPrincipal] = useState('0')
  // A new private party loan starts at 24% a year; the rate can be changed. A bank loan has no preset rate.
  const [roiPct, setRoiPct] = useState(String(DEFAULT_PRIVATE_LOAN_ROI))
  const [roiTouched, setRoiTouched] = useState(false)
  const [dateTaken, setDateTaken] = useState('')
  const [notes, setNotes] = useState('')
  const [accountId, setAccountId] = useState(CASH)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!editingLoan) return
    setLoanType(editingLoan.loan_type === 'bank' ? 'bank' : 'private')
    setLender(editingLoan.lender)
    setPrincipal(String(editingLoan.principal))
    setRoiPct(String(editingLoan.roi_pct))
    setRoiTouched(true)
    setDateTaken(editingLoan.date_taken ?? '')
    setNotes(editingLoan.notes ?? '')
    setAccountId(editingLoan.bank_account_id ?? CASH)
    setFormError(null)
  }, [editingLoan])

  function resetForm() {
    setLoanType('private')
    setLender('')
    setPrincipal('0')
    setRoiPct(String(DEFAULT_PRIVATE_LOAN_ROI))
    setRoiTouched(false)
    setDateTaken('')
    setNotes('')
    setAccountId(CASH)
  }

  /** Switching the type moves the rate between the private default and blank, unless a rate was typed. */
  function chooseType(type: 'private' | 'bank') {
    setLoanType(type)
    if (!roiTouched && !editingLoan) setRoiPct(type === 'private' ? String(DEFAULT_PRIVATE_LOAN_ROI) : '')
  }

  const monthlyInterest = monthlyInterestOn(parseINR(principal), Number(roiPct))

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!lender.trim()) {
      setFormError('Lender / source is required.')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        loan_type: loanType,
        lender: lender.trim(),
        principal: parseINR(principal),
        roi_pct: Number(roiPct) || 0,
        date_taken: dateTaken || null,
        notes: notes.trim() || null,
        payment_mode: accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH ? null : accountId,
      }
      if (editingLoan) {
        await updateLoan.mutateAsync({ id: editingLoan.id, patch })
        onDoneEditing()
      } else {
        await createLoan.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save loan.'))
    } finally {
      setSubmitting(false)
    }
  }

  const body = (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: inModal ? 0 : 16 }}>
        {/* Row 1: Loan type */}
        <div className="field full">
          <label>Loan type</label>
          <div className="pill-tabs">
            <button
              type="button"
              className={loanType === 'private' ? 'pill active' : 'pill'}
              onClick={() => chooseType('private')}
            >
              Private Party
            </button>
            <button type="button" className={loanType === 'bank' ? 'pill active' : 'pill'} onClick={() => chooseType('bank')}>
              Bank
            </button>
          </div>
        </div>

        {/* Row 2: Lender / source */}
        <div className="field full">
          <label>Lender / source</label>
          <input
            type="text"
            required
            placeholder="e.g. HDFC short-term loan, or a person's name"
            value={lender}
            onChange={(e) => setLender(e.target.value)}
          />
        </div>

        {/* Row 2: Principal, ROI */}
        <div className="field-row ln-row2">
          <div className="field ln-principal">
            <label>Principal (₹)</label>
            <CurrencyInput value={principal} onValueChange={setPrincipal} required />
          </div>
          <div className="field ln-roi">
            <label>ROI (% per annum)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={roiPct}
              onChange={(e) => {
                setRoiTouched(true)
                setRoiPct(e.target.value)
              }}
            />
            <div className="retention-note">
              {loanType === 'private' && !roiTouched && !editingLoan ? 'Preset to 24% a year (2% a month); change it if the agreed rate differs. ' : ''}
              {Number(roiPct) > 0 && parseINR(principal) > 0 ? `Monthly interest: ${fmt2(monthlyInterest)} (principal x rate / 12).` : ''}
            </div>
          </div>
        </div>

        {/* Row 3: Date taken + Account received into */}
        <div className="field-row ln-row3">
          <div className="field ln-date-taken">
            <label>Date taken</label>
            <input type="date" value={dateTaken} onChange={(e) => setDateTaken(e.target.value)} />
          </div>
          <div className="field">
            <label>Account</label>
            <SearchableSelect
              items={accountOptions}
              value={accountId}
              onChange={setAccountId}
              getId={(a) => a.id}
              getLabel={(a) => a.name}
              placeholder="— Select account —"
            />
          </div>
        </div>

        <div className="field full">
          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingLoan ? 'Save changes' : 'Add loan'}
          </Button>
          {editingLoan && (
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )

  return inModal ? (
    <div>{body}</div>
  ) : (
    <details className="toggle-section" open>
      <summary>Loans</summary>
      {body}
    </details>
  )
}
