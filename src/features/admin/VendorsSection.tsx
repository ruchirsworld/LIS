import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { VendorForm } from './VendorForm'
import { VendorTable } from './VendorTable'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorsSection() {
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <details className="toggle-section">
      <summary>Vendors</summary>

      <details
        className="toggle-section"
        style={{ marginTop: 16 }}
        open={formOpen}
        onToggle={(e) => setFormOpen(e.currentTarget.open)}
      >
        <summary>Add new vendor</summary>
        <VendorForm key="new" editingVendor={null} onDoneEditing={() => {}} />
      </details>

      {editingVendor && (
        <Modal title="Edit vendor" onClose={() => setEditingVendor(null)}>
          <VendorForm key={editingVendor.id} editingVendor={editingVendor} onDoneEditing={() => setEditingVendor(null)} />
        </Modal>
      )}

      <details className="toggle-section" style={{ marginTop: 12 }} open>
        <summary>Vendor list</summary>
        <VendorTable
          onEdit={(v) => setEditingVendor(v)}
        />
      </details>
    </details>
  )
}
