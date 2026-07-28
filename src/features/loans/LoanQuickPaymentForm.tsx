import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useLoans, useLoanPayments, useCreateLoanPayment } from '../../lib/queries/loans'
import { loanOutstanding, monthlyInterestDue } from '../../lib/calc/loans'
import { fmt, fmtPlain, parseINR } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function LoanQuickPaymentForm() {
  const { data: loans } = useLoans(null)
  const { data: payments } = useLoanPayments()
  const createPayment = useCreateLoanPayment()

  const [loanId, setLoanId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [interestPaid, setInterestPaid] = useState('0')
  const [principalPaid, setPrincipalPaid] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openLoans = loans?.filter((l) => {
    const loanPayments = payments?.filter((p) => p.loan_id === l.id) ?? []
    return loanOutstanding(l, loanPayments) > 0
  })

  const selectedLoan = openLoans?.find((l) => l.id === loanId)
  const selectedLoanPayments = payments?.filter((p) => p.loan_id === loanId) ?? []
  const monthlyInterest = selectedLoan ? monthlyInterestDue(selectedLoan, selectedLoanPayments) : 0

  function handleLoanChange(id: string) {
    setLoanId(id)
    const loan = openLoans?.find((l) => l.id === id)
    if (loan) {
      const loanPayments = payments?.filter((p) => p.loan_id === id) ?? []
      setInterestPaid(fmtPlain(monthlyInterestDue(loan, loanPayments).toFixed(2)).replace(/,/g, ''))
    } else {
      setInterestPaid('0')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!loanId) {
      setFormError('Pick a lender.')
      return
    }
    const interest = parseINR(interestPaid)
    const principal = parseINR(principalPaid)
    if (interest <= 0 && principal <= 0) {
      setFormError('Enter a principal or interest amount.')
      return
    }
    setSubmitting(true)
    try {
      await createPayment.mutateAsync({
        loan_id: loanId,
        date,
        principal_paid: principal,
        interest_paid: interest,
      })
      setLoanId('')
      setDate(todayStr())
      setInterestPaid('0')
      setPrincipalPaid('0')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Record payments</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Select lender, Date (default today) */}
        <div className="field-row lnp-row1">
          <div className="field lnp-lender">
            <label>Lender</label>
            <SearchableSelect
              items={openLoans}
              value={loanId}
              onChange={handleLoanChange}
              getId={(l) => l.id}
              getLabel={(l) => `${l.lender} (${l.display_id ?? ''}) — ${l.loan_type === 'bank' ? 'Bank' : 'Private Party'}`}
              placeholder="— Select lender —"
            />
            {selectedLoan && (
              <div className="note" style={{ marginTop: 2 }}>
                Monthly interest at current outstanding: {fmt(monthlyInterest)}
              </div>
            )}
          </div>
          <div className="field lnp-date">
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {/* Row 2: Interest amount, Principal */}
        <div className="field-row lnp-row2">
          <div className="field lnp-interest">
            <label>Interest amount (₹)</label>
            <CurrencyInput value={interestPaid} onValueChange={setInterestPaid} />
          </div>
          <div className="field lnp-principal">
            <label>Principal (₹)</label>
            <CurrencyInput value={principalPaid} onValueChange={setPrincipalPaid} />
          </div>
        </div>

        {/* Row 3: Add payment */}
        <div className="field full lnp-submit">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add payment'}
          </Button>
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
