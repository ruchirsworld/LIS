import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateSalaryAdjustment } from '../../lib/queries/team'
import { parseINR } from '../../lib/calc/format'

type AdjType = 'addition' | 'deduction'

export function SalaryAdjustmentForm({
  employeeId,
  month,
  colSpan,
  onClose,
}: {
  employeeId: string
  month: string
  colSpan: number
  onClose: () => void
}) {
  const createAdjustment = useCreateSalaryAdjustment()
  const [type, setType] = useState<AdjType>('deduction')
  const [amount, setAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const magnitude = parseINR(amount)
    if (magnitude <= 0) return
    setSaving(true)
    try {
      await createAdjustment.mutateAsync({
        employee_id: employeeId,
        month,
        amount: type === 'deduction' ? -magnitude : magnitude,
        notes: notes.trim() || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={colSpan}>
        <div className="pay-form">
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
            <input
              type="text"
              placeholder="e.g. advance recovery, bonus"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save adjustment'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  )
}
