import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateExpenseReimbursement } from '../../lib/queries/expenses'
import { allocateSettlement, type OutstandingExpense } from '../../lib/calc/expenses'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

type PaymentMode = 'UPI' | 'Cash' | 'Bank'

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank']

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
  colSpan,
  onClose,
}: {
  due: number
  outstandingExpenses: OutstandingExpense[]
  colSpan: number
  onClose: () => void
}) {
  const createReimbursement = useCreateExpenseReimbursement()
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState(fmtPlain(due).replace(/,/g, ''))
  const [reference, setReference] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    if (amt > due) {
      setError(`Amount can't exceed the total due (${fmtPlain(due)}).`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const allocations = allocateSettlement(amt, outstandingExpenses)
      for (const alloc of allocations) {
        await createReimbursement.mutateAsync({
          expense_id: alloc.expenseId,
          date,
          amount: alloc.amount,
          reference: reference.trim() || null,
          payment_mode: paymentMode,
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
          <div className="field">
            <label>Mode of payment</label>
            <div className="pill-tabs">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={paymentMode === m ? 'pill active' : 'pill'}
                  onClick={() => setPaymentMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
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
