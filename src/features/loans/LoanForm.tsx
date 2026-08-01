import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateLoan, useUpdateLoan } from '../../lib/queries/loans'
import { parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Loan = Database['public']['Tables']['loans']['Row']

export function LoanForm({
  editingLoan,
  onDoneEditing,
}: {
  editingLoan: Loan | null
  onDoneEditing: () => void
}) {
  const createLoan = useCreateLoan()
  const updateLoan = useUpdateLoan()

  const [loanType, setLoanType] = useState<'private' | 'bank'>('private')
  const [lender, setLender] = useState('')
  const [principal, setPrincipal] = useState('0')
  const [roiPct, setRoiPct] = useState('')
  const [dateTaken, setDateTaken] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!editingLoan) return
    setLoanType(editingLoan.loan_type === 'bank' ? 'bank' : 'private')
    setLender(editingLoan.lender)
    setPrincipal(String(editingLoan.principal))
    setRoiPct(String(editingLoan.roi_pct))
    setDateTaken(editingLoan.date_taken ?? '')
    setNotes(editingLoan.notes ?? '')
    setFormError(null)
  }, [editingLoan])

  function resetForm() {
    setLoanType('private')
    setLender('')
    setPrincipal('0')
    setRoiPct('')
    setDateTaken('')
    setNotes('')
  }

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

  return (
    <details className="toggle-section" open>
      <summary>Loans</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Loan type */}
        <div className="field full">
          <label>Loan type</label>
          <div className="pill-tabs">
            <button
              type="button"
              className={loanType === 'private' ? 'pill active' : 'pill'}
              onClick={() => setLoanType('private')}
            >
              Private Party
            </button>
            <button type="button" className={loanType === 'bank' ? 'pill active' : 'pill'} onClick={() => setLoanType('bank')}>
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
              onChange={(e) => setRoiPct(e.target.value)}
            />
          </div>
        </div>

        {/* Row 3: Date taken */}
        <div className="field-row ln-row3">
          <div className="field ln-date-taken">
            <label>Date taken</label>
            <input type="date" value={dateTaken} onChange={(e) => setDateTaken(e.target.value)} />
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
    </details>
  )
}
