import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateInvoicePayment, useUpdateInvoicePayment } from '../../lib/queries/invoices'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']

const CASH = 'cash'
const BANK_ORDER = ['Kotak', 'CBI']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** The actual fields + save logic, shared between recording a brand new
 * payment (wrapped in a full-width table row by InvoicePaymentForm below)
 * and editing an existing one inline in its invoice's payment history
 * (InvoiceTable.tsx), which isn't a table row so doesn't want that wrapper. */
function InvoicePaymentFields(
  props:
    | { mode: 'create'; invoiceId: string; due: number; onClose: () => void }
    | { mode: 'edit'; payment: InvoicePayment; onClose: () => void }
) {
  const createPayment = useCreateInvoicePayment()
  const updatePayment = useUpdateInvoicePayment()
  const { data: bankAccounts } = useBankAccounts()
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

  const initial = props.mode === 'edit' ? props.payment : null
  const [date, setDate] = useState(initial ? initial.date : todayStr())
  const [amount, setAmount] = useState(fmtPlain(initial ? initial.amount : props.mode === 'create' ? props.due : 0).replace(/,/g, ''))
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [accountId, setAccountId] = useState(initial?.bank_account_id ?? CASH)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Defaults a brand-new payment's Account to CBI once bank accounts load —
  // only ever once, so it doesn't fight a deliberate later choice of Cash
  // (also represented by '' internally) — and never for an existing payment
  // being edited, which keeps whatever it was actually saved with.
  const defaultedAccountRef = useRef(false)
  useEffect(() => {
    if (props.mode !== 'create' || defaultedAccountRef.current || !cbiAccountId) return
    defaultedAccountRef.current = true
    setAccountId(cbiAccountId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cbiAccountId])

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
      const patch = {
        date,
        amount: amt,
        reference: reference.trim() || null,
        payment_mode: accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH ? null : accountId,
      }
      if (props.mode === 'edit') {
        await updatePayment.mutateAsync({ id: props.payment.id, patch })
      } else {
        await createPayment.mutateAsync({ invoice_id: props.invoiceId, ...patch })
      }
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this receipt.')
    } finally {
      setSaving(false)
    }
  }

  return (
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
      <div className="field">
        <label>Reference / receipt no.</label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <Button type="button" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Save payment'}
      </Button>
      <Button type="button" variant="secondary" onClick={props.onClose}>
        Cancel
      </Button>
      {error && (
        <div className="note" style={{ color: 'var(--red)', flexBasis: '100%' }}>
          {error}
        </div>
      )}
    </div>
  )
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
  return (
    <tr className="pay-form-row">
      <td colSpan={15}>
        <InvoicePaymentFields mode="create" invoiceId={invoiceId} due={due} onClose={onClose} />
      </td>
    </tr>
  )
}

export function EditInvoicePaymentFields({ payment, onClose }: { payment: InvoicePayment; onClose: () => void }) {
  return <InvoicePaymentFields mode="edit" payment={payment} onClose={onClose} />
}
