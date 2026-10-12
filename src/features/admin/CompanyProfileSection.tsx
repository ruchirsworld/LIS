import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useCompanyProfile, useRepostAllInvoices, useUpdateCompanyProfile } from '../../lib/queries/books'
import { cleanGstin, isValidGstin, isValidPan, panOfGstin, stateLabelOfGstin } from '../../lib/gst'
import { fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

/** The business's own identity for ledgers and invoices (name, GSTIN, PAN,
 * address) and the period lock. The GSTIN's state code is what decides, per
 * client, whether GST is CGST + SGST (same state) or IGST (different state). */
export function CompanyProfileSection() {
  const { profile } = useAuth()
  const { data: company } = useCompanyProfile()
  const update = useUpdateCompanyProfile()
  const repost = useRepostAllInvoices()
  const [repostMessage, setRepostMessage] = useState<string | null>(null)
  const isAdmin = profile?.role === 'admin'

  const [name, setName] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [address, setAddress] = useState('')
  const [lockedUntil, setLockedUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!company) return
    setName(company.name ?? '')
    setGstin(company.gstin ?? '')
    setPan(company.pan ?? '')
    setAddress(company.address ?? '')
    setLockedUntil(company.books_locked_until ?? '')
  }, [company])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!company) return
    setError(null)
    setSaved(false)
    const g = cleanGstin(gstin)
    const p = pan.trim().toUpperCase() || panOfGstin(g)
    if (g && !isValidGstin(g)) {
      setError('That GSTIN is not valid — it should be 15 characters, like 27ABCDE1234F1Z5.')
      return
    }
    if (p && !isValidPan(p)) {
      setError('That PAN is not valid — it should be 10 characters, like ABCDE1234F.')
      return
    }
    if (g && p && panOfGstin(g) !== p) {
      setError('The PAN does not match the one inside the GSTIN.')
      return
    }
    setSaving(true)
    try {
      await update.mutateAsync({
        id: company.id,
        patch: {
          name: name.trim() || null,
          gstin: g || null,
          pan: p || null,
          address: address.trim() || null,
          state_code: g ? g.slice(0, 2) : null,
          // Only an Admin can move the lock.
          ...(isAdmin ? { books_locked_until: lockedUntil || null } : {}),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the company details.'))
    } finally {
      setSaving(false)
    }
  }

  async function repostAll() {
    setRepostMessage(null)
    setError(null)
    try {
      const n = await repost.mutateAsync()
      setRepostMessage(`Re-posted ${n} invoice${n === 1 ? '' : 's'} with the GST split.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not re-post the invoices.'))
    }
  }

  const stateLabel = stateLabelOfGstin(gstin)

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <h3 style={{ marginTop: 0, fontSize: 13 }}>Company details</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Printed on ledgers and used to split GST: a client in the same state as your GSTIN gets CGST + SGST, any other state gets IGST.
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>GSTIN</label>
          <input
            type="text"
            maxLength={15}
            placeholder="27ABCDE1234F1Z5"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
          />
          <div className="note">{stateLabel ? `State: ${stateLabel}` : 'The first two digits give your state.'}</div>
        </div>
        <div className="field">
          <label>PAN</label>
          <input
            type="text"
            maxLength={10}
            placeholder={panOfGstin(gstin) || 'ABCDE1234F'}
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
          />
        </div>
        <div className="field full">
          <label>Address</label>
          <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label>Books locked up to</label>
          <input type="date" value={lockedUntil} disabled={!isAdmin} onChange={(e) => setLockedUntil(e.target.value)} />
          <div className="note">
            {lockedUntil
              ? `Nothing dated on or before ${fmtDate(lockedUntil)} can be added, changed or removed.`
              : 'Set this to the end of a closed financial year (e.g. 31 Mar) so its entries stay as filed.'}
            {!isAdmin && ' Only an Admin can change the lock.'}
          </div>
        </div>
        <div className="field full">
          <Button type="submit" disabled={saving || !company}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="note" style={{ marginLeft: 10 }}>Saved.</span>}
        </div>
        {isAdmin && (
          <div className="field full">
            <Button type="button" variant="secondary" onClick={repostAll} disabled={repost.isPending}>
              {repost.isPending ? 'Re-posting…' : 'Re-post invoices with the GST split'}
            </Button>
            <div className="note">
              Run this after saving the GSTIN: it re-posts past invoices so their GST is split into CGST / SGST / IGST. Totals do not change.
              Clients without a GSTIN stay under "not split".
            </div>
            {repostMessage && <div className="note">{repostMessage}</div>}
          </div>
        )}
        {error && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </form>
    </div>
  )
}
