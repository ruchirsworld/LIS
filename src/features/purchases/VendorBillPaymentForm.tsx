import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateVendorBillPayment, useUpdateVendorBillPayment } from '../../lib/queries/purchases'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorBillPaymentForm({
  billId,
  due,
  editingPayment,
  colSpan,
  onClose,
}: {
  billId: string
  due: number
  editingPayment?: VendorBillPayment | null
  colSpan: number
  onClose: () => void
}) {
  const createPayment = useCreateVendorBillPayment()
  const updatePayment = useUpdateVendorBillPayment()
  const [date, setDate] = useState(editingPayment?.date ?? todayStr())
  const [amount, setAmount] = useState(
    fmtPlain(editingPayment ? editingPayment.amount : due).replace(/,/g, ''),
  )
  const [reference, setReference] = useState(editingPayment?.reference ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    setSaving(true)
    setError(null)
    try {
      if (editingPayment) {
        await updatePayment.mutateAsync({
          id: editingPayment.id,
          patch: { date, amount: amt, reference: reference.trim() || null },
        })
      } else {
        await createPayment.mutateAsync({
          bill_id: billId,
          date,
          amount: amt,
          reference: reference.trim() || null,
        })
      }
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
            <label>Amount (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} />
          </div>
          <div className="field">
            <label>Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editingPayment ? 'Save changes' : 'Save payment'}
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
