import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateLoanPayment } from '../../lib/queries/loans'
import { parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

const CASH = 'cash'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function LoanPaymentForm({
  loanId,
  colSpan,
  onClose,
}: {
  loanId: string
  colSpan: number
  onClose: () => void
}) {
  const createPayment = useCreateLoanPayment()
  const { data: bankAccounts } = useBankAccounts()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(bankAccounts ?? [])]

  const [date, setDate] = useState(todayStr())
  const [principalPaid, setPrincipalPaid] = useState('0')
  const [interestPaid, setInterestPaid] = useState('0')
  const [reference, setReference] = useState('')
  const [accountId, setAccountId] = useState(CASH)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const principal = parseINR(principalPaid)
    const interest = parseINR(interestPaid)
    if (!date || principal + interest <= 0) {
      setError('Enter a principal or interest amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createPayment.mutateAsync({
        loan_id: loanId,
        date,
        principal_paid: principal,
        interest_paid: interest,
        reference: reference.trim() || null,
        payment_mode: accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH ? null : accountId,
      })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save payment.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={colSpan}>
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
          {error && (
            <div className="note" style={{ color: 'var(--red)', flexBasis: '100%' }}>
              {error}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
