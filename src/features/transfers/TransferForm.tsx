import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateTransfer } from '../../lib/queries/transfers'
import { parseINR } from '../../lib/calc/format'

const CASH = 'cash'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function TransferForm() {
  const { data: accounts } = useBankAccounts()
  const createTransfer = useCreateTransfer()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(accounts ?? [])]

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('0')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!fromId || !toId) {
      setFormError('Pick a source and destination.')
      return
    }
    if (fromId === toId) {
      setFormError('Source and destination must be different.')
      return
    }
    const amt = parseINR(amount)
    if (amt <= 0) {
      setFormError('Enter a transfer amount.')
      return
    }
    setSubmitting(true)
    try {
      await createTransfer.mutateAsync({
        from_account_id: fromId === CASH ? null : fromId,
        to_account_id: toId === CASH ? null : toId,
        amount: amt,
        date,
        notes: notes.trim() || null,
      })
      setFromId('')
      setToId('')
      setAmount('0')
      setDate(todayStr())
      setNotes('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record transfer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Transfers</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>From</label>
          <SearchableSelect
            items={accountOptions}
            value={fromId}
            onChange={setFromId}
            getId={(a) => a.id}
            getLabel={(a) => a.name}
            placeholder="— Select source —"
          />
        </div>
        <div className="field">
          <label>To</label>
          <SearchableSelect
            items={accountOptions}
            value={toId}
            onChange={setToId}
            getId={(a) => a.id}
            getLabel={(a) => a.name}
            placeholder="— Select destination —"
          />
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
            {submitting ? 'Adding…' : 'Add transfer'}
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
