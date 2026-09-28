import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useCreateVendorFull } from '../../lib/queries/admin'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

const CATEGORY_OPTIONS = ['Plant Nursery', 'Material', 'Contractor', 'Equipment Rental']
const NEW_CATEGORY = '__newcategory__'

/** Full vendor-detail popup, opened from the "add a new vendor" checkbox
 * next to VendorCombobox — mirrors AdminPage's VendorForm fields, so a
 * vendor added on the fly while billing gets the same real record (name,
 * category, phone, GST/PAN, address) instead of a name-only stub. */
export function AddVendorModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName?: string
  onClose: () => void
  onCreated: (vendor: Vendor) => void
}) {
  const createVendor = useCreateVendorFull()

  const [name, setName] = useState(initialName ?? '')
  const [category, setCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [gstpan, setGstpan] = useState('')
  const [address, setAddress] = useState('')
  const [isOneTime, setIsOneTime] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
    setSubmitting(true)
    try {
      const finalCategory = category === NEW_CATEGORY ? newCategoryName.trim() : category
      const created = await createVendor.mutateAsync({
        name: name.trim(),
        category: finalCategory || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        gstpan: gstpan.trim() || null,
        address: address.trim() || null,
        is_one_time: isOneTime,
      })
      onCreated(created)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save vendor.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add a new vendor" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
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
          <label>GST/PAN</label>
          <input type="text" value={gstpan} onChange={(e) => setGstpan(e.target.value)} />
        </div>
        <div className="field full">
          <label>Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field full row-inline">
          <input type="checkbox" id="av-one-time" checked={isOneTime} onChange={(e) => setIsOneTime(e.target.checked)} />
          <label htmlFor="av-one-time">
            One-time vendor — use for this bill only and keep out of the vendor list
          </label>
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Add vendor'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        {formError && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {formError}
          </div>
        )}
      </form>
    </Modal>
  )
}
