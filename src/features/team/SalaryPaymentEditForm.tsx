import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useUpdateSalaryPayment, useDeleteSalaryPayment } from '../../lib/queries/team'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type SalaryPayment = Database['public']['Tables']['salary_payments']['Row']

export function SalaryPaymentEditForm({ payment, onClose }: { payment: SalaryPayment; onClose: () => void }) {
  const updatePayment = useUpdateSalaryPayment()
  const deletePayment = useDeleteSalaryPayment()
  const [date, setDate] = useState(payment.date)
  const [amount, setAmount] = useState(fmtPlain(payment.amount).replace(/,/g, ''))
  const [notes, setNotes] = useState(payment.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    setSaving(true)
    try {
      await updatePayment.mutateAsync({ id: payment.id, patch: { date, amount: amt, notes: notes.trim() || null } })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await deletePayment.mutateAsync(payment.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pay-form" style={{ marginTop: 4 }}>
      <div className="field">
        <label>Payment date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Amount (₹)</label>
        <CurrencyInput value={amount} onValueChange={setAmount} />
      </div>
      <div className="field">
        <label>Notes</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="button" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <button type="button" className="btn danger-link" onClick={remove} disabled={saving}>
        Remove
      </button>
    </div>
  )
}
