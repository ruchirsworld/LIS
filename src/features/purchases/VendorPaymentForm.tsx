import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments, useCreateVendorBillPayment } from '../../lib/queries/purchases'
import { billDue } from '../../lib/calc/vendorBills'
import { fmt, parseINR } from '../../lib/calc/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorPaymentForm() {
  const { data: vendors } = useVendors()
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()
  const createPayment = useCreateVendorBillPayment()

  const [vendorId, setVendorId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Oldest outstanding bill for the selected vendor absorbs the payment (FIFO).
  const vendorOpenBills = (bills ?? [])
    .filter((b) => b.vendor_id === vendorId)
    .map((b) => ({ bill: b, due: billDue(b, payments?.filter((p) => p.bill_id === b.id) ?? []) }))
    .filter((row) => row.due > 0)
    .sort((a, b) => (a.bill.date ?? '9999-99-99').localeCompare(b.bill.date ?? '9999-99-99'))
  const totalDue = vendorOpenBills.reduce((s, row) => s + row.due, 0)
  const target = vendorOpenBills[0]

  function handleVendorChange(id: string) {
    setVendorId(id)
  }

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
      })
      setVendorId('')
      setDate(todayStr())
      setAmount('0')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Add vendor payment</summary>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Vendor</label>
          <SearchableSelect
            items={vendors}
            value={vendorId}
            onChange={handleVendorChange}
            getId={(v) => v.id}
            getLabel={(v) => v.name}
            placeholder="— Select vendor —"
          />
          {vendorId && target && (
            <div className="note" style={{ marginTop: 2 }}>
              Total due: {fmt(totalDue)} — will auto-adjust against {target.bill.display_id ?? 'oldest bill'}
            </div>
          )}
          {vendorId && !target && (
            <div className="note" style={{ marginTop: 2, color: 'var(--red)' }}>
              No outstanding bills for this vendor.
            </div>
          )}
        </div>

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
          <Button type="submit" disabled={submitting || (!!vendorId && !target)}>
            {submitting ? 'Adding…' : 'Add payment'}
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
