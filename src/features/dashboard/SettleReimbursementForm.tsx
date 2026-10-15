import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { PaymentAccountPicker, bankAccountIdOf, paymentModeOf } from '../../components/PaymentAccountPicker'
import { useCreateExpenseReimbursement } from '../../lib/queries/expenses'
import { allocateSettlement, chosenSettlementProblem, chosenToAllocations, oldestFirstChoices, type ChosenAmounts, type OutstandingExpense } from '../../lib/calc/expenses'
import { SettlementEntryPicker, type PickerEntry } from './SettlementEntryPicker'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Settles a user's reimbursement due in one lump sum, oldest expense
 * first — splits the entered amount across as many outstanding expenses
 * as it takes to exhaust it, partially settling the last one if it
 * doesn't divide evenly. */
export function SettleReimbursementForm({
  due,
  outstandingExpenses,
  entries,
  colSpan,
  onClose,
}: {
  due: number
  outstandingExpenses: OutstandingExpense[]
  /** The entries behind outstandingExpenses, so the person can choose which ones this payment settles. */
  entries?: PickerEntry[]
  colSpan: number
  onClose: () => void
}) {
  const createReimbursement = useCreateExpenseReimbursement()
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState(fmtPlain(due).replace(/,/g, ''))
  const [reference, setReference] = useState('')
  const [accountId, setAccountId] = useState('')
  const [choose, setChoose] = useState(false)
  const [picks, setPicks] = useState<ChosenAmounts>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    if (amt > due) {
      setError(`Amount can't exceed the total due (${fmtPlain(due)}).`)
      return
    }
    if (choose) {
      const problem = chosenSettlementProblem(amt, picks, outstandingExpenses)
      if (problem) {
        setError(problem)
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      const allocations = choose ? chosenToAllocations(picks, outstandingExpenses) : allocateSettlement(amt, outstandingExpenses)
      for (const alloc of allocations) {
        await createReimbursement.mutateAsync({
          ...(alloc.source === 'vendor_payment'
            ? { vendor_bill_payment_id: alloc.expenseId }
            : { expense_id: alloc.expenseId }),
          date,
          amount: alloc.amount,
          reference: reference.trim() || null,
          payment_mode: paymentModeOf(accountId),
          bank_account_id: bankAccountIdOf(accountId),
        })
      }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not settle reimbursement.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={colSpan}>
        <div className="pay-form">
          <div className="field">
            <label>Settlement date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Amount to settle (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} />
          </div>
          <PaymentAccountPicker style={{ flexBasis: '100%' }} value={accountId} onChange={setAccountId} />
          {entries && entries.length > 0 && (
            <label style={{ flexBasis: '100%', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={choose}
                onChange={(e) => {
                  setChoose(e.target.checked)
                  if (e.target.checked) setPicks(oldestFirstChoices(parseINR(amount), outstandingExpenses))
                }}
              />
              Choose which entries this payment settles (otherwise the oldest are settled first)
            </label>
          )}
          {choose && entries && (
            <SettlementEntryPicker entries={entries} outstanding={outstandingExpenses} amount={parseINR(amount)} value={picks} onChange={setPicks} />
          )}

          <div className="field">
            <label>Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={submitting}>
            {submitting ? 'Settling…' : 'Settle'}
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
