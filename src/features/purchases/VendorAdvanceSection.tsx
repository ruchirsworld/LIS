import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { PaymentAccountPicker, bankAccountIdOf, paymentModeOf } from '../../components/PaymentAccountPicker'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useVendors } from '../../lib/queries/masters'
import { useCreateVendorAdvance, useDeleteVendorAdvance, useVendorAdvances, useVendorBillPayments } from '../../lib/queries/purchases'
import { advanceBalance, advanceUsed } from '../../lib/calc/vendorAdvances'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { confirmAction, toast } from '../../lib/feedback'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Money paid to a vendor before there is a bill. When the vendor's bill is entered, the oldest advance is set
 * against it automatically, and only the rest is left to pay. */
export function VendorAdvanceSection() {
  const { data: vendors } = useVendors()
  const { data: advances, isLoading } = useVendorAdvances()
  const { data: payments } = useVendorBillPayments()
  const createAdvance = useCreateVendorAdvance()
  const deleteAdvance = useDeleteVendorAdvance()

  const [vendorId, setVendorId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const vendorName = (id: string) => vendors?.find((v) => v.id === id)?.name ?? '—'
  const openBalance = (advances ?? []).reduce((s, a) => s + advanceBalance(a, payments ?? []), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const amt = parseINR(amount)
    if (!vendorId) return setFormError('Pick the vendor.')
    if (amt <= 0) return setFormError('Enter the amount paid.')
    if (!accountId) return setFormError('Pick the account the money was paid from.')
    setSubmitting(true)
    try {
      await createAdvance.mutateAsync({
        vendor_id: vendorId,
        date,
        amount: amt,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        payment_mode: paymentModeOf(accountId) === 'Cash' ? 'Cash' : 'Bank',
        bank_account_id: bankAccountIdOf(accountId),
      })
      toast('success', 'Advance recorded. It will be set against this vendor’s bills as they are entered.')
      setVendorId('')
      setAmount('0')
      setReference('')
      setNotes('')
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not record the advance.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string, used: number) {
    const ok = await confirmAction({
      title: 'Remove this advance?',
      message:
        used > 0
          ? `${fmt(used)} of it has already been set against bills. Removing it undoes that too, and those bills become due again (unless another advance covers them).`
          : 'The money paid is taken out of the books again.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteAdvance.mutateAsync(id)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not remove the advance.'))
    }
  }

  return (
    <details className="toggle-section">
      <summary>Advances to vendors{openBalance > 0.004 ? ` — ${fmt(openBalance)} not yet used` : ''}</summary>
      <div className="note" style={{ marginTop: 12 }}>
        Use this when you pay a vendor before there is a bill. When you enter the vendor&rsquo;s bill, the oldest advance is set against it automatically, so you only pay what is left.
      </div>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field">
          <label>Vendor</label>
          <SearchableSelect items={vendors} value={vendorId} onChange={setVendorId} getId={(v) => v.id} getLabel={(v) => v.name} getSearchValue={(v) => `${v.name} ${v.phone ?? ''}`} placeholder="— Select vendor —" />
        </div>
        <div className="field">
          <label>Amount paid (₹)</label>
          <CurrencyInput value={amount} onValueChange={setAmount} required />
        </div>
        <div className="field">
          <label>Date paid</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Reference</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <PaymentAccountPicker className="full" value={accountId} onChange={setAccountId} />
        <div className="field full">
          <label>What it is for (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record advance'}
          </Button>
        </div>
      </form>
      {formError && (
        <div className="note" role="alert" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Vendor</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Set against bills</th>
              <th style={{ textAlign: 'right' }}>Not yet used</th>
              <th>Reference</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (advances ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No advances recorded
                </td>
              </tr>
            )}
            {(advances ?? []).map((a) => {
              const used = advanceUsed(a, payments ?? [])
              return (
                <tr key={a.id}>
                  <td>{a.display_id ?? '—'}</td>
                  <td>{fmtDate(a.date)}</td>
                  <td>{vendorName(a.vendor_id)}</td>
                  <td className="amt">{fmt(a.amount)}</td>
                  <td className="amt">{fmt(used)}</td>
                  <td className="amt">{fmt(advanceBalance(a, payments ?? []))}</td>
                  <td>{a.reference ?? '—'}</td>
                  <td>
                    <RowMenu items={[{ label: 'Remove', onClick: () => void remove(a.id, used) }]} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
    </details>
  )
}
