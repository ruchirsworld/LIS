import { useState, type FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '../../components/ui'
import { useCostCenters } from '../../lib/queries/masters'
import {
  useCreateCostCenter,
  useRenameCostCenter,
  useDeleteCostCenter,
  useReorderCostCenters,
} from '../../lib/queries/admin'
import type { Database } from '../../types/database'

type CostCenterRow = Database['public']['Tables']['cost_centers']['Row']

function SortableCard({
  item,
  editing,
  editingName,
  onEditingNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
}: {
  item: CostCenterRow
  editing: boolean
  editingName: string
  onEditingNameChange: (v: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onCancelRename: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} className="card" style={{ ...style, marginTop: 12, padding: 12 }}>
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            autoFocus
            style={{ flex: 1 }}
          />
          <button type="button" className="btn" onClick={onSaveRename}>
            Save
          </button>
          <button type="button" className="btn secondary" onClick={onCancelRename}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--ink-soft)' }} title="Drag to reorder">
              ⠿
            </span>
            <strong>{item.name}</strong>
          </div>
          <div>
            <button type="button" className="pay-btn" onClick={onStartRename}>
              Rename
            </button>
            <button type="button" className="btn danger-link" onClick={onDelete}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CostCentersSection() {
  const { data: costCenters, isLoading } = useCostCenters()
  const createCostCenter = useCreateCostCenter()
  const renameCostCenter = useRenameCostCenter()
  const deleteCostCenter = useDeleteCostCenter()
  const reorderCostCenters = useReorderCostCenters()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    setSubmitting(true)
    try {
      await createCostCenter.mutateAsync(name.trim())
      setName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveRename() {
    if (!editingId || !editingName.trim()) return
    await renameCostCenter.mutateAsync({ id: editingId, name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !costCenters) return
    const oldIndex = costCenters.findIndex((c) => c.id === active.id)
    const newIndex = costCenters.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(costCenters, oldIndex, newIndex)
    reorderCostCenters.mutate(reordered.map((c) => c.id))
  }

  return (
    <details className="toggle-section">
      <summary>Cost centers</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Chandigarh office"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add cost center'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      {isLoading && <div className="note">Loading…</div>}
      {!isLoading && (!costCenters || costCenters.length === 0) && (
        <div className="note">None yet — add one above</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(costCenters ?? []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {costCenters?.map((c) => (
            <SortableCard
              key={c.id}
              item={c}
              editing={editingId === c.id}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onStartRename={() => {
                setEditingId(c.id)
                setEditingName(c.name)
              }}
              onSaveRename={saveRename}
              onCancelRename={() => setEditingId(null)}
              onDelete={() => deleteCostCenter.mutate(c.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </details>
  )
}
