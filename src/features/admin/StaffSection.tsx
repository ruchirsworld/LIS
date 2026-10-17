import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { StaffForm } from './StaffForm'
import { StaffTable } from './StaffTable'
import type { Database } from '../../types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export function StaffSection() {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <details className="toggle-section">
      <summary>Staff</summary>

      <details
        className="toggle-section"
        style={{ marginTop: 16 }}
        open={formOpen}
        onToggle={(e) => setFormOpen(e.currentTarget.open)}
      >
        <summary>Add new staff</summary>
        <StaffForm key="new" editingStaff={null} onDoneEditing={() => {}} />
      </details>

      {editingStaff && (
        <Modal title="Edit staff" onClose={() => setEditingStaff(null)}>
          <StaffForm key={editingStaff.id} editingStaff={editingStaff} onDoneEditing={() => setEditingStaff(null)} />
        </Modal>
      )}

      <details className="toggle-section" style={{ marginTop: 12 }} open>
        <summary>Staff list</summary>
        <StaffTable
          onEdit={(s) => setEditingStaff(s)}
        />
      </details>
    </details>
  )
}
