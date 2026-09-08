import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients, useBankAccounts } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments, useCreateInvoicePayment } from '../../lib/queries/invoices'
import { dueAmount } from '../../lib/calc/invoices'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'

const CASH = 'cash'
const BANK_ORDER = ['Kotak', 'CBI']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function InvoiceReceiptForm() {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()
  const { data: bankAccounts } = useBankAccounts()
  const createPayment = useCreateInvoicePayment()
  // Kotak first, then CBI, then anything else alphabetically, Cash always
  // last — same order and pill-button treatment as Expenses/Imprest.
  const sortedBankAccounts = [...(bankAccounts ?? [])].sort((a, b) => {
    const ai = BANK_ORDER.indexOf(a.name)
    const bi = BANK_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const accountOptions = [...sortedBankAccounts, { id: CASH, name: 'Cash' }]
  const cbiAccountId = sortedBankAccounts.find((a) => a.name.trim().toLowerCase() === 'cbi')?.id ?? CASH

  const [clientId, setClientId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState(CASH)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Defaults Account to CBI once bank accounts load — only ever once, so it
  // doesn't fight a deliberate later choice of Cash (also represented by
  // '' internally).
  const defaultedAccountRef = useRef(false)
  useEffect(() => {
    if (defaultedAccountRef.current || !cbiAccountId) return
    defaultedAccountRef.current = true
    setAccountId(cbiAccountId)
  }, [cbiAccountId])

  // If the user picks a specific invoice, the receipt applies to that one.
  // Otherwise, the oldest outstanding invoice for the client absorbs it (FIFO).
  const clientOpenInvoices = (invoices ?? [])
    .filter((inv) => inv.client_id === clientId)
    .map((inv) => ({ invoice: inv, due: dueAmount(inv, payments?.filter((p) => p.invoice_id === inv.id) ?? []) }))
    .filter((row) => row.due > 0)
    .sort((a, b) => (a.invoice.invoice_date ?? '9999-99-99').localeCompare(b.invoice.invoice_date ?? '9999-99-99'))
  const target = invoiceId
    ? clientOpenInvoices.find((row) => row.invoice.id === invoiceId)
    : clientOpenInvoices[0]

  function handleClientChange(id: string) {
    setClientId(id)
    setInvoiceId('')
  }

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
        payment_mode: accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH ? null : accountId,
      })
      setClientId('')
      setInvoiceId('')
      setDate(todayStr())
      setAmount('0')
      setAccountId(cbiAccountId)
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
            onChange={handleClientChange}
            getId={(c) => c.id}
            getLabel={(c) => clientLabel(c)}
            placeholder="— Select client —"
          />
        </div>

        {clientId && (
          <div className="field full rr-invoice">
            <label>Invoice (optional)</label>
            <SearchableSelect
              items={clientOpenInvoices.map((row) => row.invoice)}
              value={invoiceId}
              onChange={setInvoiceId}
              getId={(inv) => inv.id}
              getLabel={(inv) => {
                const row = clientOpenInvoices.find((r) => r.invoice.id === inv.id)
                return `${inv.invoice_number ?? inv.display_id ?? 'Invoice'} — ${fmtDate(inv.invoice_date)} — Due: ${fmt(row?.due ?? 0)}`
              }}
              placeholder="— Auto-adjust against oldest due —"
            />
            {target && (
              <div className="note" style={{ marginTop: 2 }}>
                {invoiceId ? 'Applies to' : 'Will auto-adjust against'} {target.invoice.invoice_number ?? target.invoice.display_id ?? 'this invoice'} — Due: {fmt(target.due)}
              </div>
            )}
            {!target && (
              <div className="note" style={{ marginTop: 2, color: 'var(--red)' }}>
                No outstanding invoices for this client.
              </div>
            )}
          </div>
        )}

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

        <div className="field full rr-account">
          <label>Account</label>
          <div className="pill-tabs">
            {accountOptions.map((a) => (
              <button
                key={a.id}
                type="button"
                className={accountId === a.id ? 'pill active' : 'pill'}
                onClick={() => setAccountId(a.id)}
              >
                {a.name}
              </button>
            ))}
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
