import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useCreateVendorFull, useUpdateVendor } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { getErrorMessage } from '../../lib/errors'
import { cleanGstin, isValidGstin, isValidPan, panOfGstin } from '../../lib/gst'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

const CATEGORY_OPTIONS = ['Plant Nursery', 'Material', 'Contractor', 'Equipment Rental']
const NEW_CATEGORY = '__newcategory__'

export function VendorForm({
  editingVendor,
  onDoneEditing,
}: {
  editingVendor: Vendor | null
  onDoneEditing: () => void
}) {
  const { profile } = useAuth()
  const canAdd = profile?.role === 'admin' || profile?.role === 'cxo'
  const createVendor = useCreateVendorFull()
  const updateVendor = useUpdateVendor()

  const [name, setName] = useState(editingVendor?.name ?? '')
  const [category, setCategory] = useState(
    editingVendor?.category && !CATEGORY_OPTIONS.includes(editingVendor.category)
      ? NEW_CATEGORY
      : editingVendor?.category ?? '',
  )
  const [newCategoryName, setNewCategoryName] = useState(
    editingVendor?.category && !CATEGORY_OPTIONS.includes(editingVendor.category) ? editingVendor.category : '',
  )
  const [contactPerson, setContactPerson] = useState(editingVendor?.contact_person ?? '')
  const [phone, setPhone] = useState(editingVendor?.phone ?? '')
  const [gstin, setGstin] = useState(editingVendor?.gstin ?? '')
  const [pan, setPan] = useState(editingVendor?.pan ?? '')
  const [address, setAddress] = useState(editingVendor?.address ?? '')
  const [isOneTime, setIsOneTime] = useState(editingVendor?.is_one_time ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setCategory('')
    setNewCategoryName('')
    setContactPerson('')
    setPhone('')
    setGstin('')
    setPan('')
    setAddress('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Vendor name is required.')
      return
    }
    if (category === NEW_CATEGORY && !newCategoryName.trim()) {
      setFormError('Enter a name for the new category.')
      return
    }
    const g = cleanGstin(gstin)
    const p = pan.trim().toUpperCase() || panOfGstin(g)
    if (g && !isValidGstin(g)) {
      setFormError('That GSTIN is not valid — it should be 15 characters, like 07ABCDE1234F1Z5.')
      return
    }
    if (p && !isValidPan(p)) {
      setFormError('That PAN is not valid — it should be 10 characters, like ABCDE1234F.')
      return
    }
    setSubmitting(true)
    try {
      const finalCategory = category === NEW_CATEGORY ? newCategoryName.trim() : category
      const patch = {
        name: name.trim(),
        category: finalCategory || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        gstin: g || null,
        pan: p || null,
        address: address.trim() || null,
      }
      if (editingVendor) {
        // Only editable here, not on create — unticking it is how a one-time
        // vendor gets promoted into the regular vendor list.
        await updateVendor.mutateAsync({ id: editingVendor.id, patch: { ...patch, is_one_time: isOneTime } })
        onDoneEditing()
      } else {
        await createVendor.mutateAsync(patch)
        resetForm()
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save vendor.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!editingVendor && !canAdd) {
    return <div className="note">Only Admin and CXO accounts can add new vendors.</div>
  }

  return (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Vendor name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Select —</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ Add new category…</option>
          </select>
        </div>
        {category === NEW_CATEGORY && (
          <div className="field">
            <label>New category name</label>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Contact person</label>
          <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="field">
          <label>Phone no.</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>GSTIN</label>
          <input type="text" maxLength={15} placeholder="Leave blank if unregistered" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
        </div>
        <div className="field">
          <label>PAN (needed for TDS)</label>
          <input type="text" maxLength={10} placeholder={panOfGstin(gstin) || 'ABCDE1234F'} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} />
        </div>
        <div className="field full">
          <label>Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        {editingVendor && (
          <div className="field full row-inline">
            <input type="checkbox" id="vf-one-time" checked={isOneTime} onChange={(e) => setIsOneTime(e.target.checked)} />
            <label htmlFor="vf-one-time">One-time vendor — keep out of the vendor list (untick to make permanent)</label>
          </div>
        )}

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingVendor ? 'Save changes' : 'Add vendor'}
          </Button>
          {editingVendor && (
            <Button type="button" variant="secondary" onClick={onDoneEditing}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )
}
