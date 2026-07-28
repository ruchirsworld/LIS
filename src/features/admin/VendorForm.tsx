import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useCreateVendorFull, useUpdateVendor } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
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
  const [gstpan, setGstpan] = useState(editingVendor?.gstpan ?? '')
  const [address, setAddress] = useState(editingVendor?.address ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setCategory('')
    setNewCategoryName('')
    setContactPerson('')
    setPhone('')
    setGstpan('')
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
    setSubmitting(true)
    try {
      const finalCategory = category === NEW_CATEGORY ? newCategoryName.trim() : category
      const patch = {
        name: name.trim(),
        category: finalCategory || null,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        gstpan: gstpan.trim() || null,
        address: address.trim() || null,
      }
      if (editingVendor) {
        await updateVendor.mutateAsync({ id: editingVendor.id, patch })
        onDoneEditing()
      } else {
        await createVendor.mutateAsync(patch)
        resetForm()
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save vendor.')
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
          <label>GST/PAN</label>
          <input type="text" value={gstpan} onChange={(e) => setGstpan(e.target.value)} />
        </div>
        <div className="field full">
          <label>Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

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
