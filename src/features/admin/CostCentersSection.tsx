import { useState, type FormEvent, type KeyboardEvent } from 'react'
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
  useUpdateCostCenterTags,
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
  tagDraft,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
}: {
  item: CostCenterRow
  editing: boolean
  editingName: string
  onEditingNameChange: (v: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onCancelRename: () => void
  onDelete: () => void
  tagDraft: string
  onTagDraftChange: (v: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const tags = item.tags ?? []

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAddTag()
    }
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

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.length === 0 && <span className="note" style={{ margin: 0 }}>No tags yet</span>}
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: 12,
              padding: '2px 4px 2px 9px',
              fontSize: 11,
            }}
          >
            #{tag}
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              aria-label={`Remove tag ${tag}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: '0 4px',
                fontSize: 13,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input
          type="text"
          placeholder="Add a tag, press Enter"
          value={tagDraft}
          onChange={(e) => onTagDraftChange(e.target.value)}
          onKeyDown={handleTagKeyDown}
          style={{ flex: 1 }}
        />
        <button type="button" className="pay-btn" onClick={onAddTag}>
          Add tag
        </button>
      </div>
    </div>
  )
}

export function CostCentersSection() {
  const { data: costCenters, isLoading } = useCostCenters()
  const createCostCenter = useCreateCostCenter()
  const renameCostCenter = useRenameCostCenter()
  const deleteCostCenter = useDeleteCostCenter()
  const reorderCostCenters = useReorderCostCenters()
  const updateTags = useUpdateCostCenterTags()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({})

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

  async function addTag(costCenterId: string, currentTags: string[]) {
    const draft = (tagDraft[costCenterId] ?? '').trim()
    if (!draft || currentTags.includes(draft)) {
      setTagDraft((d) => ({ ...d, [costCenterId]: '' }))
      return
    }
    await updateTags.mutateAsync({ id: costCenterId, tags: [...currentTags, draft] })
    setTagDraft((d) => ({ ...d, [costCenterId]: '' }))
  }

  async function removeTag(costCenterId: string, currentTags: string[], tag: string) {
    await updateTags.mutateAsync({ id: costCenterId, tags: currentTags.filter((t) => t !== tag) })
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
              tagDraft={tagDraft[c.id] ?? ''}
              onTagDraftChange={(v) => setTagDraft((d) => ({ ...d, [c.id]: v }))}
              onAddTag={() => addTag(c.id, c.tags ?? [])}
              onRemoveTag={(tag) => removeTag(c.id, c.tags ?? [], tag)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </details>
  )
}
