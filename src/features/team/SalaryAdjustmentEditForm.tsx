import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useUpdateSalaryAdjustment, useDeleteSalaryAdjustment } from '../../lib/queries/team'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type SalaryAdjustment = Database['public']['Tables']['salary_adjustments']['Row']
type AdjType = 'addition' | 'deduction'

export function SalaryAdjustmentEditForm({
  adjustment,
  onClose,
}: {
  adjustment: SalaryAdjustment
  onClose: () => void
}) {
  const updateAdjustment = useUpdateSalaryAdjustment()
  const deleteAdjustment = useDeleteSalaryAdjustment()
  const [type, setType] = useState<AdjType>(adjustment.amount < 0 ? 'deduction' : 'addition')
  const [amount, setAmount] = useState(fmtPlain(Math.abs(adjustment.amount)).replace(/,/g, ''))
  const [notes, setNotes] = useState(adjustment.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const magnitude = parseINR(amount)
    if (magnitude <= 0) return
    setSaving(true)
    try {
      await updateAdjustment.mutateAsync({
        id: adjustment.id,
        patch: { amount: type === 'deduction' ? -magnitude : magnitude, notes: notes.trim() || null },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await deleteAdjustment.mutateAsync(adjustment.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pay-form" style={{ marginTop: 4 }}>
      <div className="field">
        <label>Type</label>
        <div className="pill-tabs">
          <button
            type="button"
            className={type === 'deduction' ? 'pill active' : 'pill'}
            onClick={() => setType('deduction')}
          >
            Deduction
          </button>
          <button
            type="button"
            className={type === 'addition' ? 'pill active' : 'pill'}
            onClick={() => setType('addition')}
          >
            Addition
          </button>
        </div>
      </div>
      <div className="field">
        <label>Amount (₹)</label>
        <CurrencyInput value={amount} onValueChange={setAmount} />
      </div>
      <div className="field">
        <label>Reason</label>
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
