import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useCreateInvoiceNote } from '../../lib/queries/books'
import { fmt, parseINR } from '../../lib/calc/format'
import { round2 } from '../../lib/calc/invoices'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** A credit or debit note against an issued invoice. Under GST an invoice
 * that has gone to the client is not edited — a note carries the change, with
 * its own number and date, at the invoice's own GST and TDS rates. */
export function InvoiceNoteForm({
  invoice,
  type,
  onClose,
}: {
  invoice: Invoice
  type: 'credit' | 'debit'
  onClose: () => void
}) {
  const createNote = useCreateInvoiceNote()
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const taxable = parseINR(amount)
  const gst = round2((taxable * Number(invoice.gst_pct || 0)) / 100)
  const tds = round2((taxable * Number(invoice.tds_pct || 0)) / 100)
  const label = type === 'credit' ? 'Credit note' : 'Debit note'

  async function save() {
    setError(null)
    if (taxable <= 0) {
      setError('Enter the amount before GST.')
      return
    }
    if (!reason.trim()) {
      setError('Say why — a note needs a reason (for example "rate revision" or "quantity short").')
      return
    }
    setSaving(true)
    try {
      await createNote.mutateAsync({ invoice_id: invoice.id, note_type: type, date, amount: taxable, reason: reason.trim() })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, `Could not save the ${label.toLowerCase()}.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={15}>
        <div className="pay-form">
          <div className="field">
            <label>{label} date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Amount before GST (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Reason</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : `Save ${label.toLowerCase()}`}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <div className="note" style={{ flexBasis: '100%' }}>
            {taxable > 0
              ? `${type === 'credit' ? 'Reduces' : 'Adds to'} ${invoice.invoice_number ?? invoice.display_id}: ${fmt(taxable)} + GST ${fmt(gst)} (${invoice.gst_pct}%) − TDS ${fmt(tds)} (${invoice.tds_pct}%) = ${fmt(taxable + gst - tds)}.`
              : `The ${label.toLowerCase()} uses the invoice's own GST (${invoice.gst_pct}%) and TDS (${invoice.tds_pct}%) rates.`}
          </div>
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
