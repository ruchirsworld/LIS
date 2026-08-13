import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useVendorBills, useVendorBillPayments, useCreateVendorBillPayment } from '../../lib/queries/purchases'
import { billDue } from '../../lib/calc/vendorBills'
import { fmt, parseINR } from '../../lib/calc/format'

type PaymentMode = 'UPI' | 'NEFT' | 'Cash'

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'NEFT', 'Cash']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Payment form for a vendor that's already selected on the page — the
 * oldest outstanding bill for that vendor absorbs the payment (FIFO),
 * same as before, just without its own vendor picker. */
export function VendorPaymentForm({ vendorId, onDone }: { vendorId: string; onDone: () => void }) {
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()
  const createPayment = useCreateVendorBillPayment()

  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const vendorOpenBills = (bills ?? [])
    .filter((b) => b.vendor_id === vendorId)
    .map((b) => ({ bill: b, due: billDue(b, payments?.filter((p) => p.bill_id === b.id) ?? []) }))
    .filter((row) => row.due > 0)
    .sort((a, b) => (a.bill.date ?? '9999-99-99').localeCompare(b.bill.date ?? '9999-99-99'))
  const totalDue = vendorOpenBills.reduce((s, row) => s + row.due, 0)
  const target = vendorOpenBills[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!target) {
      setFormError('This vendor has no outstanding bills.')
      return
    }
    const amt = parseINR(amount)
    if (amt <= 0) {
      setFormError('Enter a payment amount.')
      return
    }
    setSubmitting(true)
    try {
      await createPayment.mutateAsync({
        bill_id: target.bill.id,
        date,
        amount: amt,
        payment_mode: paymentMode,
      })
      onDone()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {target ? (
        <div className="note" style={{ marginTop: 0 }}>
          Total due: {fmt(totalDue)} — will auto-adjust against {target.bill.display_id ?? 'oldest bill'}
        </div>
      ) : (
        <div className="note" style={{ marginTop: 0, color: 'var(--red)' }}>
          No outstanding bills for this vendor.
        </div>
      )}

      <div className="field-row">
        <div className="field field-narrow">
          <label>Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Amount (₹)</label>
          <CurrencyInput value={amount} onValueChange={setAmount} required />
        </div>
      </div>

      <div className="field full">
        <label>Mode of payment</label>
        <div className="pill-tabs">
          {PAYMENT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={paymentMode === m ? 'pill active' : 'pill'}
              onClick={() => setPaymentMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="field full">
        <Button type="submit" disabled={submitting || !target}>
          {submitting ? 'Adding…' : 'Add payment'}
        </Button>
      </div>

      {formError && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {formError}
        </div>
      )}
    </form>
  )
}
