import { useState } from 'react'
import { Button } from '../../components/ui'
import { useUpdateInvoice } from '../../lib/queries/invoices'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

/** The GST-release tracker for one invoice: the client holds the GST until we
 * have deposited it (GSTR-3B) and sent them proof. Record when it was filed
 * and when the proof went; the release itself is recorded as part of a
 * payment ("Of which GST released"). None of this touches the ledger. */
export function GstReleaseForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const updateInvoice = useUpdateInvoice()
  const [hold, setHold] = useState(!!invoice.gst_on_hold)
  const [period, setPeriod] = useState(invoice.gstr3b_period ?? '')
  const [filedOn, setFiledOn] = useState(invoice.gstr3b_filed_on ?? '')
  const [sentOn, setSentOn] = useState(invoice.gstr3b_sent_on ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (sentOn && !filedOn) {
      setError('Proof can only be sent once the GSTR-3B has been filed — add the filing date.')
      return
    }
    if (filedOn && sentOn && sentOn < filedOn) {
      setError('The proof cannot be sent before the return was filed.')
      return
    }
    setSaving(true)
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        patch: {
          gst_on_hold: hold,
          gstr3b_period: period || null,
          gstr3b_filed_on: filedOn || null,
          gstr3b_sent_on: sentOn || null,
        },
      })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the GST release details.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="pay-form-row">
      <td colSpan={15}>
        <div className="pay-form">
          <label className="check-inline" style={{ flexBasis: '100%' }}>
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} />
            The client releases this invoice's GST only after GSTR-3B proof
          </label>
          {hold && (
            <>
              <div className="field field-narrow">
                <label>GSTR-3B period</label>
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="field">
                <label>Filed / deposited on</label>
                <input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
              </div>
              <div className="field">
                <label>Proof sent to client on</label>
                <input type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} />
              </div>
            </>
          )}
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
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
