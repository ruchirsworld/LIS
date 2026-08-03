import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateExpenseReimbursement, useUpdateExpenseReimbursement } from '../../lib/queries/expenses'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type ExpenseReimbursement = Database['public']['Tables']['expense_reimbursements']['Row']
type PaymentMode = 'UPI' | 'Cash' | 'Bank'

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ExpenseReimbursementForm({
  expenseId,
  due,
  editingReimbursement,
  colSpan,
  onClose,
}: {
  expenseId: string
  due: number
  editingReimbursement?: ExpenseReimbursement | null
  colSpan: number
  onClose: () => void
}) {
  const createReimbursement = useCreateExpenseReimbursement()
  const updateReimbursement = useUpdateExpenseReimbursement()
  const [date, setDate] = useState(editingReimbursement?.date ?? todayStr())
  const [amount, setAmount] = useState(
    fmtPlain(editingReimbursement ? editingReimbursement.amount : due).replace(/,/g, ''),
  )
  const [reference, setReference] = useState(editingReimbursement?.reference ?? '')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>((editingReimbursement?.payment_mode as PaymentMode) ?? 'UPI')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    setSaving(true)
    setError(null)
    try {
      if (editingReimbursement) {
        await updateReimbursement.mutateAsync({
          id: editingReimbursement.id,
          patch: { date, amount: amt, reference: reference.trim() || null, payment_mode: paymentMode },
        })
      } else {
        await createReimbursement.mutateAsync({
          expense_id: expenseId,
          date,
          amount: amt,
          reference: reference.trim() || null,
          payment_mode: paymentMode,
        })
      }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save reimbursement.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={colSpan}>
        <div className="pay-form">
          <div className="field">
            <label>Reimbursement date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Amount (₹)</label>
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
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editingReimbursement ? 'Save changes' : 'Save reimbursement'}
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
