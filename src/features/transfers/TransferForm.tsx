import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateTransfer, useUpdateTransfer } from '../../lib/queries/transfers'
import { parseINR } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type Transfer = Database['public']['Tables']['transfers']['Row']

const CASH = 'cash'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Adds a transfer, or (with `editing`) changes one in place. When editing it is shown without its section heading, for a popup. */
export function TransferForm({ editing, onDone }: { editing?: Transfer; onDone?: () => void } = {}) {
  const { data: accounts } = useBankAccounts()
  const createTransfer = useCreateTransfer()
  const updateTransfer = useUpdateTransfer()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(accounts ?? [])]

  const [fromId, setFromId] = useState(editing ? editing.from_account_id ?? CASH : '')
  const [toId, setToId] = useState(editing ? editing.to_account_id ?? CASH : '')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '0')
  const [date, setDate] = useState(editing?.date ?? todayStr())
  const [notes, setNotes] = useState(editing?.notes ?? '')
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
      const fields = {
        from_account_id: fromId === CASH ? null : fromId,
        to_account_id: toId === CASH ? null : toId,
        amount: amt,
        date,
        notes: notes.trim() || null,
      }
      if (editing) {
        await updateTransfer.mutateAsync({ id: editing.id, patch: fields })
        onDone?.()
        return
      }
      await createTransfer.mutateAsync(fields)
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

  const body = (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: editing ? 0 : 16 }}>
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
            {submitting ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save changes' : 'Add transfer'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )

  return editing ? (
    <div>{body}</div>
  ) : (
    <details className="toggle-section" open>
      <summary>Transfers</summary>
      {body}
    </details>
  )
}
