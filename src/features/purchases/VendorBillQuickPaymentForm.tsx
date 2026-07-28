import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useVendorBills, useVendorBillPayments, useCreateVendorBillPayment } from '../../lib/queries/purchases'
import { useVendors } from '../../lib/queries/masters'
import { billDue } from '../../lib/calc/vendorBills'
import { fmt, parseINR } from '../../lib/calc/format'
import { VendorCombobox } from './VendorCombobox'
import { useVendorCategoryFilter, VendorCategoryPills } from './VendorCategoryFilter'

const PAYMENT_MODES = ['UPI', 'NEFT', 'Cash'] as const
type PaymentMode = (typeof PAYMENT_MODES)[number]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorBillQuickPaymentForm() {
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()
  const { data: vendors } = useVendors()
  const createPayment = useCreateVendorBillPayment()

  const [vendorId, setVendorId] = useState('')
  const { categories: vendorCategories, category: vendorCategory, setCategory: setVendorCategory, filteredVendors } =
    useVendorCategoryFilter(vendors, () => setVendorId(''))
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Oldest outstanding bill for the selected vendor absorbs the payment
  // (FIFO) — the user picks a vendor, not a specific bill.
  const vendorOpenBills = (bills ?? [])
    .filter((b) => b.vendor_id === vendorId)
    .map((b) => ({ bill: b, due: billDue(b, payments?.filter((p) => p.bill_id === b.id) ?? []) }))
    .filter((row) => row.due > 0)
    .sort((a, b) => (a.bill.date ?? '').localeCompare(b.bill.date ?? ''))
  const target = vendorOpenBills[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!vendorId) {
      setFormError('Pick a vendor.')
      return
    }
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
      setVendorId('')
      setVendorCategory(null)
      setDate(todayStr())
      setAmount('0')
      setPaymentMode('UPI')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Record payments</summary>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full vbp-bill">
          <label>Vendor type</label>
          <VendorCategoryPills categories={vendorCategories} category={vendorCategory} onChange={setVendorCategory} />
          <label>Vendor</label>
          <VendorCombobox vendors={filteredVendors} value={vendorId} onChange={setVendorId} />
          {vendorId && target && (
            <div className="note" style={{ marginTop: 2 }}>
              Applies to {target.bill.display_id ?? 'this bill'} — Due: {fmt(target.due)}
            </div>
          )}
          {vendorId && !target && (
            <div className="note" style={{ marginTop: 2, color: 'var(--red)' }}>
              No outstanding bills for this vendor.
            </div>
          )}
        </div>

        <div className="field-row vbp-row2">
          <div className="field vbp-date">
            <label>Date of payment</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field vbp-amount">
            <label>Amount (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} required />
          </div>
        </div>

        <div className="field-row vbp-row3">
          <div className="field vbp-mode">
            <label>Payment Mode</label>
            <div className="pill-tabs">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={paymentMode === mode ? 'pill active' : 'pill'}
                  onClick={() => setPaymentMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="field vbp-submit">
            <label>&nbsp;</label>
            <Button type="submit" disabled={submitting || (!!vendorId && !target)}>
              {submitting ? 'Adding…' : 'Add payment'}
            </Button>
          </div>
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
