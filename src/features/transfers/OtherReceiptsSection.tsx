import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { PaymentAccountPicker, bankAccountIdOf, paymentModeOf } from '../../components/PaymentAccountPicker'
import { PeriodFilter } from '../../components/PeriodFilter'
import { RowMenu } from '../../components/RowMenu'
import { TableScroll } from '../../components/TableScroll'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { OTHER_RECEIPT_KINDS, otherReceiptAccount, otherReceiptLabel, type OtherReceiptKind } from '../../lib/calc/otherReceipts'
import type { DateRange } from '../../lib/calc/period'
import { getErrorMessage } from '../../lib/errors'
import { confirmAction, toast } from '../../lib/feedback'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateOtherReceipt, useDeleteOtherReceipt, useOtherReceipts } from '../../lib/queries/otherReceipts'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

const todayStr = () => new Date().toISOString().slice(0, 10)

/** Money received that is not a client payment, a loan, partner capital or a transfer: a deposit given back, interest,
 * a refund, scrap sold, or other income. */
export function OtherReceiptsSection() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: receipts, isLoading } = useOtherReceipts(range)
  const { data: banks } = useBankAccounts()
  const create = useCreateOtherReceipt()
  const remove = useDeleteOtherReceipt()

  const [kind, setKind] = useState<OtherReceiptKind>('security_deposit')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [payer, setPayer] = useState('')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [accountId, setAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bankName = (id: string | null) => (id ? banks?.find((b) => b.id === id)?.name ?? '—' : 'Cash')
  const kindInfo = OTHER_RECEIPT_KINDS.find((k) => k.value === kind)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const amt = parseINR(amount)
    if (amt <= 0) return setError('Enter the amount received.')
    if (!accountId) return setError('Pick the account the money came into.')
    setSubmitting(true)
    try {
      await create.mutateAsync({
        kind,
        date,
        amount: amt,
        payer: payer.trim() || null,
        notes: notes.trim() || null,
        reference: reference.trim() || null,
        payment_mode: paymentModeOf(accountId) === 'Cash' ? 'Cash' : 'Bank',
        bank_account_id: bankAccountIdOf(accountId),
      })
      toast('success', 'Money received recorded.')
      setAmount('0')
      setPayer('')
      setNotes('')
      setReference('')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function askRemove(id: string, label: string) {
    const ok = await confirmAction({ title: 'Remove this entry?', message: `${label}. The money is taken out of the books again.`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    try {
      await remove.mutateAsync(id)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not remove it.'))
    }
  }

  const sections: ExportSection[] = [
    {
      title: 'Other money received',
      columns: ['ID', 'Date', 'What', 'From', 'Account', 'Amount', 'Notes', 'Reference'],
      rows: (receipts ?? []).map((r) => [r.display_id ?? '', fmtDate(r.date), otherReceiptLabel(r.kind), r.payer ?? '', bankName(r.bank_account_id), r.amount, r.notes ?? '', r.reference ?? '']),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Other money received</summary>
      <div className="note" style={{ marginTop: 12 }}>
        For money that came in for any reason other than a client payment, a loan, partner capital or a transfer between your own accounts: a security deposit given back, interest, a refund, scrap sold, or other income.
      </div>

      <form className="form-grid" onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="field full">
          <label htmlFor="or-kind">What was it?</label>
          <select id="or-kind" value={kind} onChange={(e) => setKind(e.target.value as OtherReceiptKind)}>
            {OTHER_RECEIPT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <div className="retention-note">
            {kindInfo?.hint} {kind === 'security_deposit' ? 'It reduces Security Deposits, so it does not count as income.' : 'It is recorded as Other Income, so it adds to your profit.'}
          </div>
        </div>
        <div className="field">
          <label htmlFor="or-amount">Amount (₹)</label>
          <CurrencyInput id="or-amount" value={amount} onValueChange={setAmount} required />
        </div>
        <div className="field">
          <label htmlFor="or-date">Date received</label>
          <input id="or-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <PaymentAccountPicker className="full" label="Received into" value={accountId} onChange={setAccountId} />
        <div className="field">
          <label htmlFor="or-payer">Received from (optional)</label>
          <input id="or-payer" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="e.g. the landlord of the old office" />
        </div>
        <div className="field">
          <label htmlFor="or-ref">Reference (optional)</label>
          <input id="or-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor="or-notes">Note (optional)</label>
          <input id="or-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record money received'}
          </Button>
        </div>
      </form>
      {error && (
        <div className="note" role="alert" style={{ color: 'var(--red)', marginTop: -10 }}>
          {error}
        </div>
      )}

      <div className="toolbar">
        <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
        <ReportExportButtons title="Other money received" sections={sections} range={range} style={{ marginTop: 0 }} />
      </div>
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>What</th>
              <th>From</th>
              <th>Into</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (receipts ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  Nothing recorded in this period
                </td>
              </tr>
            )}
            {(receipts ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.display_id ?? '—'}</td>
                <td>{fmtDate(r.date)}</td>
                <td>
                  {otherReceiptLabel(r.kind)}
                  <div className="retention-note">Credited to {otherReceiptAccount(r.kind).name}</div>
                </td>
                <td>
                  {r.payer ?? '—'}
                  {r.notes && <div className="retention-note">{r.notes}</div>}
                </td>
                <td>{bankName(r.bank_account_id)}</td>
                <td className="amt">{fmt(r.amount)}</td>
                <td>
                  <RowMenu items={[{ label: 'Remove', onClick: () => void askRemove(r.id, `${otherReceiptLabel(r.kind)} of ${fmt(r.amount)} on ${fmtDate(r.date)}`) }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </details>
  )
}
