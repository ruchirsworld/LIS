import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useVendorBills, useVendorBillPayments, useCreateVendorBillPayment } from '../../lib/queries/purchases'
import { billDue } from '../../lib/calc/vendorBills'
import { fmt, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

const CASH = 'cash'
// Not a real account — an employee paid the vendor out of pocket, so no
// cash/bank moves and the firm owes that employee instead.
const REIMBURSE = 'reimbursement'

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
  const { data: bankAccounts } = useBankAccounts()
  const { data: profiles } = useProfiles()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(bankAccounts ?? []), { id: REIMBURSE, name: 'Reimbursement' }]

  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState(CASH)
  const [paidBy, setPaidBy] = useState('')
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
    if (accountId === REIMBURSE && !paidBy) {
      setFormError('Pick who paid, so they can be reimbursed.')
      return
    }
    setSubmitting(true)
    try {
      await createPayment.mutateAsync({
        bill_id: target.bill.id,
        date,
        amount: amt,
        payment_mode: accountId === REIMBURSE ? 'Reimbursement' : accountId === CASH ? 'Cash' : 'Bank',
        bank_account_id: accountId === CASH || accountId === REIMBURSE ? null : accountId,
        paid_by: accountId === REIMBURSE ? paidBy : null,
      })
      onDone()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not record payment.'))
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

      {accountId === REIMBURSE && (
        <div className="field full">
          <label>Paid by (to be reimbursed)</label>
          <SearchableSelect
            items={profiles}
            value={paidBy}
            onChange={setPaidBy}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select person —"
          />
        </div>
      )}

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
