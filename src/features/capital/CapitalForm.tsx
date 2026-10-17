import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { PaymentAccountPicker, bankAccountIdOf, paymentModeOf, CASH_ACCOUNT } from '../../components/PaymentAccountPicker'
import { useProfiles } from '../../lib/queries/admin'
import { useCreateCapitalTx, useUpdateCapitalTx } from '../../lib/queries/capital'
import { parseINR } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type CapitalTx = Database['public']['Tables']['capital_transactions']['Row']


function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Adds a capital entry, or (with `editing`) changes one in place, without the section heading, for a popup. */
export function CapitalForm({ editing, onDone }: { editing?: CapitalTx; onDone?: () => void } = {}) {
  const { data: profiles } = useProfiles()
  // Partners are Admin and CXO only — a Supervisor is just an employee and
  // has no stake (or say) in capital.
  const partners = (profiles ?? []).filter((p) => p.role === 'admin' || p.role === 'cxo')
  const createCapitalTx = useCreateCapitalTx()
  const updateCapitalTx = useUpdateCapitalTx()

  const [partnerId, setPartnerId] = useState(editing?.partner_id ?? '')
  const [type, setType] = useState<'injection' | 'withdrawal'>(editing?.type === 'withdrawal' ? 'withdrawal' : 'injection')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '0')
  const [date, setDate] = useState(editing?.date ?? todayStr())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [accountId, setAccountId] = useState(editing ? editing.bank_account_id ?? CASH_ACCOUNT : '')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!partnerId) {
      setFormError('Pick a partner.')
      return
    }
    if (!accountId) {
      setFormError('Pick an account.')
      return
    }
    setSubmitting(true)
    try {
      const fields = {
        partner_id: partnerId,
        type,
        amount: parseINR(amount),
        date,
        notes: notes.trim() || null,
        payment_mode: paymentModeOf(accountId),
        bank_account_id: bankAccountIdOf(accountId),
      }
      if (editing) {
        await updateCapitalTx.mutateAsync({ id: editing.id, patch: fields })
        onDone?.()
        return
      }
      await createCapitalTx.mutateAsync(fields)
      setPartnerId('')
      setType('injection')
      setAmount('0')
      setDate(todayStr())
      setNotes('')
      setAccountId('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add entry.')
    } finally {
      setSubmitting(false)
    }
  }

  const body = (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: editing ? 0 : 16 }}>
        <div className="field">
          <label>Partner</label>
          <SearchableSelect
            items={partners}
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
        <PaymentAccountPicker
          className="full"
          label={type === 'withdrawal' ? 'Payment account' : 'Receiving account'}
          value={accountId}
          onChange={setAccountId}
        />


        <div className="field full">
          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save changes' : 'Add entry'}
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
      <summary>Capital transactions</summary>
      {body}
    </details>
  )
}
