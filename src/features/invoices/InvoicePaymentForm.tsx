import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateInvoicePayment } from '../../lib/queries/invoices'
import { fmtPlain, parseINR } from '../../lib/calc/format'

const CASH = 'cash'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function InvoicePaymentForm({
  invoiceId,
  due,
  onClose,
}: {
  invoiceId: string
  due: number
  onClose: () => void
}) {
  const createPayment = useCreateInvoicePayment()
  const { data: bankAccounts } = useBankAccounts()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(bankAccounts ?? [])]
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState(fmtPlain(due).replace(/,/g, ''))
  const [reference, setReference] = useState('')
  const [accountId, setAccountId] = useState(CASH)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    if (!accountId) {
      setError('Pick an account.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createPayment.mutateAsync({
        invoice_id: invoiceId,
        date,
        amount: amt,
        reference: reference.trim() || null,
        payment_mode: accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH ? null : accountId,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={14}>
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
            <label>Account</label>
            <SearchableSelect
              items={accountOptions}
              value={accountId}
              onChange={setAccountId}
              getId={(a) => a.id}
              getLabel={(a) => a.name}
              placeholder="— Select account —"
            />
          </div>
          <div className="field">
            <label>Reference / receipt no.</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save payment'}
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
