import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments, useCreateInvoicePayment } from '../../lib/queries/invoices'
import { dueAmount } from '../../lib/calc/invoices'
import { fmt, parseINR } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function InvoiceReceiptForm() {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const createPayment = useCreateInvoicePayment()

  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Oldest outstanding invoice for the selected client absorbs the receipt
  // (FIFO) — the user picks a client, not a specific invoice.
  const clientOpenInvoices = (invoices ?? [])
    .filter((inv) => inv.client_id === clientId)
    .map((inv) => ({ invoice: inv, due: dueAmount(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? []) }))
    .filter((row) => row.due > 0)
    .sort((a, b) => (a.invoice.invoice_date ?? '9999-99-99').localeCompare(b.invoice.invoice_date ?? '9999-99-99'))
  const target = clientOpenInvoices[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!clientId) {
      setFormError('Pick a client.')
      return
    }
    if (!target) {
      setFormError('This client has no outstanding invoices.')
      return
    }
    const amt = parseINR(amount)
    if (amt <= 0) {
      setFormError('Enter a receipt amount.')
      return
    }
    setSubmitting(true)
    try {
      await createPayment.mutateAsync({
        invoice_id: target.invoice.id,
        date,
        amount: amt,
      })
      setClientId('')
      setDate(todayStr())
      setAmount('0')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record receipt.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Record receipts</summary>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full rr-client">
          <label>Client</label>
          <SearchableSelect
            items={clients}
            value={clientId}
            onChange={setClientId}
            getId={(c) => c.id}
            getLabel={(c) => clientLabel(c)}
            placeholder="— Select client —"
          />
          {clientId && target && (
            <div className="note" style={{ marginTop: 2 }}>
              Applies to {target.invoice.invoice_number ?? 'this invoice'} — Due: {fmt(target.due)}
            </div>
          )}
          {clientId && !target && (
            <div className="note" style={{ marginTop: 2, color: 'var(--red)' }}>
              No outstanding invoices for this client.
            </div>
          )}
        </div>

        <div className="field-row rr-row2">
          <div className="field rr-date">
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field rr-amount">
            <label>Amount (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} required />
          </div>
        </div>

        <div className="field full rr-submit">
          <Button type="submit" disabled={submitting || (!!clientId && !target)}>
            {submitting ? 'Adding…' : 'Add receipt'}
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
