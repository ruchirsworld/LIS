import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateLoanPayment } from '../../lib/queries/loans'
import { totalInterestDue, type LoanRow, type LoanPaymentRow } from '../../lib/calc/loans'
import { fmtPlain, parseINR } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function LoanPaymentForm({
  loanId,
  loan,
  payments,
  onClose,
}: {
  loanId: string
  loan: LoanRow
  payments: LoanPaymentRow[]
  onClose: () => void
}) {
  const createPayment = useCreateLoanPayment()
  const [date, setDate] = useState(todayStr())
  const [principalPaid, setPrincipalPaid] = useState('0')
  const [interestPaid, setInterestPaid] = useState(fmtPlain(totalInterestDue(loan, payments).toFixed(2)).replace(/,/g, ''))
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const principal = parseINR(principalPaid)
    const interest = parseINR(interestPaid)
    if (!date || (principal <= 0 && interest <= 0)) return
    setSaving(true)
    try {
      await createPayment.mutateAsync({
        loan_id: loanId,
        date,
        principal_paid: principal,
        interest_paid: interest,
        reference: reference.trim() || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={10}>
        <div className="pay-form">
          <div className="field">
            <label>Payment date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Principal paid (₹)</label>
            <CurrencyInput value={principalPaid} onValueChange={setPrincipalPaid} />
          </div>
          <div className="field">
            <label>Interest paid (₹)</label>
            <CurrencyInput value={interestPaid} onValueChange={setInterestPaid} />
          </div>
          <div className="field">
            <label>Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save payment'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  )
}
