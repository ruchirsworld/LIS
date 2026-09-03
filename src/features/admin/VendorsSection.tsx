import { useState } from 'react'
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
        <summary>{editingVendor ? 'Edit vendor' : 'Add new vendor'}</summary>
        <VendorForm
          key={editingVendor?.id ?? 'new'}
          editingVendor={editingVendor}
          onDoneEditing={() => setEditingVendor(null)}
        />
      </details>

      <details className="toggle-section" style={{ marginTop: 12 }} open>
        <summary>Vendor list</summary>
        <VendorTable
          onEdit={(v) => {
            setFormOpen(true)
            setEditingVendor(v)
          }}
        />
      </details>
    </details>
  )
}
