import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProfiles } from '../../lib/queries/admin'
import { useCreateCapitalTx } from '../../lib/queries/capital'
import { parseINR } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function CapitalForm() {
  const { data: profiles } = useProfiles()
  const createCapitalTx = useCreateCapitalTx()

  const [partnerId, setPartnerId] = useState('')
  const [type, setType] = useState<'injection' | 'withdrawal'>('injection')
  const [amount, setAmount] = useState('0')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!partnerId) {
      setFormError('Pick a partner.')
      return
    }
    setSubmitting(true)
    try {
      await createCapitalTx.mutateAsync({
        partner_id: partnerId,
        type,
        amount: parseINR(amount),
        date,
        notes: notes.trim() || null,
      })
      setPartnerId('')
      setType('injection')
      setAmount('0')
      setDate(todayStr())
      setNotes('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add entry.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Capital transactions</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Partner</label>
          <SearchableSelect
            items={profiles}
            value={partnerId}
            onChange={setPartnerId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select partner —"
          />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="injection">Capital injection (in)</option>
            <option value="withdrawal">Withdrawal (out)</option>
          </select>
        </div>

        <div className="field">
          <label>Amount (₹)</label>
          <CurrencyInput value={amount} onValueChange={setAmount} required />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field full">
          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add entry'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
