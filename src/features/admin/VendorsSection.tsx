import { useState } from 'react'
import { VendorForm } from './VendorForm'
import { VendorTable } from './VendorTable'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorsSection() {
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  return (
    <details className="toggle-section">
      <summary>Vendors</summary>
      <VendorForm
        key={editingVendor?.id ?? 'new'}
        editingVendor={editingVendor}
        onDoneEditing={() => setEditingVendor(null)}
      />
      <VendorTable onEdit={setEditingVendor} />
    </details>
  )
}
