import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useBankAccounts } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useCreateVendorBillPayment, useUpdateVendorBillPayment } from '../../lib/queries/purchases'
import { fmtPlain, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type VendorBillPayment = Database['public']['Tables']['vendor_bill_payments']['Row']

const CASH = 'cash'
// Not a real account — an employee paid the vendor out of pocket, so no
// cash/bank moves and the firm owes that employee instead.
const REIMBURSE = 'reimbursement'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorBillPaymentForm({
  billId,
  due,
  editingPayment,
  colSpan,
  onClose,
}: {
  billId: string
  due: number
  editingPayment?: VendorBillPayment | null
  colSpan: number
  onClose: () => void
}) {
  const createPayment = useCreateVendorBillPayment()
  const updatePayment = useUpdateVendorBillPayment()
  const { data: bankAccounts } = useBankAccounts()
  const { data: profiles } = useProfiles()
  const accountOptions = [{ id: CASH, name: 'Cash' }, ...(bankAccounts ?? []), { id: REIMBURSE, name: 'Reimbursement' }]
  const [date, setDate] = useState(editingPayment?.date ?? todayStr())
  const [amount, setAmount] = useState(
    fmtPlain(editingPayment ? editingPayment.amount : due).replace(/,/g, ''),
  )
  const [reference, setReference] = useState(editingPayment?.reference ?? '')
  const [accountId, setAccountId] = useState(
    editingPayment?.payment_mode === 'Reimbursement' ? REIMBURSE : editingPayment?.bank_account_id ?? CASH,
  )
  const [paidBy, setPaidBy] = useState(editingPayment?.paid_by ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseINR(amount)
    if (!date || amt <= 0) return
    if (!accountId) {
      setError('Pick an account.')
      return
    }
    if (accountId === REIMBURSE && !paidBy) {
      setError('Pick who paid, so they can be reimbursed.')
      return
    }
    setSaving(true)
    setError(null)
    const bankAccountId = accountId === CASH || accountId === REIMBURSE ? null : accountId
    const paymentMode = accountId === REIMBURSE ? 'Reimbursement' : accountId === CASH ? 'Cash' : 'Bank'
    const paidById = accountId === REIMBURSE ? paidBy : null
    try {
      if (editingPayment) {
        await updatePayment.mutateAsync({
          id: editingPayment.id,
          patch: {
            date,
            amount: amt,
            reference: reference.trim() || null,
            payment_mode: paymentMode,
            bank_account_id: bankAccountId,
            paid_by: paidById,
          },
        })
      } else {
        await createPayment.mutateAsync({
          bill_id: billId,
          date,
          amount: amt,
          reference: reference.trim() || null,
          payment_mode: paymentMode,
          bank_account_id: bankAccountId,
          paid_by: paidById,
        })
      }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save payment.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={colSpan}>
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
          {accountId === REIMBURSE && (
            <div className="field">
              <label>Paid by</label>
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
          <div className="field">
            <label>Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editingPayment ? 'Save changes' : 'Save payment'}
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
