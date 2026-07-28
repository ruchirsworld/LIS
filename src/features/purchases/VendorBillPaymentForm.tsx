import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateVendorBillPayment } from '../../lib/queries/purchases'
import { fmtPlain, parseINR } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorBillPaymentForm({
  billId,
  due,
  onClose,
}: {
  billId: string
  due: number
  onClose: () => void
}) {
  const createPayment = useCreateVendorBillPayment()
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState(fmtPlain(due).replace(/,/g, ''))
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    setSaving(true)
    try {
      await createPayment.mutateAsync({
        bill_id: billId,
        date,
        amount: amt,
        reference: reference.trim() || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={13}>
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
