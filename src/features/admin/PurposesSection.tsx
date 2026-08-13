import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../../components/ui'
import { useExpensePurposes } from '../../lib/queries/masters'
import {
  useCreateExpensePurpose,
  useRenameExpensePurpose,
  useDeleteExpensePurpose,
  useUpdateExpensePurposeTags,
} from '../../lib/queries/admin'

/** "Purpose" is the Projects cost center's own breakdown (ADMIN/LABOR/PR/
 * MISC by default) — each with its own tag list, same pattern as Cost
 * centers' tags, feeding future KPI calculations. */
export function PurposesSection() {
  const { data: purposes, isLoading } = useExpensePurposes()
  const createPurpose = useCreateExpensePurpose()
  const renamePurpose = useRenameExpensePurpose()
  const deletePurpose = useDeleteExpensePurpose()
  const updateTags = useUpdateExpensePurposeTags()

  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const [tagDraft, setTagDraft] = useState<Record<string, string>>({})

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!newName.trim()) {
      setFormError('Purpose name is required.')
      return
    }
    setSubmitting(true)
    try {
      await createPurpose.mutateAsync(newName.trim())
      setNewName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add purpose.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveRename() {
    if (!editingId || !editingName.trim()) return
    await renamePurpose.mutateAsync({ id: editingId, name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
  }

  async function addTag(id: string, currentTags: string[]) {
    const draft = (tagDraft[id] ?? '').trim()
    if (!draft || currentTags.includes(draft)) {
      setTagDraft((d) => ({ ...d, [id]: '' }))
      return
    }
    await updateTags.mutateAsync({ id, tags: [...currentTags, draft] })
    setTagDraft((d) => ({ ...d, [id]: '' }))
  }

  async function removeTag(id: string, currentTags: string[], tag: string) {
    await updateTags.mutateAsync({ id, tags: currentTags.filter((t) => t !== tag) })
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string, currentTags: string[]) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(id, currentTags)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Purposes</summary>

      <form className="form-grid" onSubmit={handleAdd} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Purpose name</label>
          <input
            type="text"
            required
            placeholder="e.g. TRAVEL"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add purpose'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      {isLoading && <div className="note">Loading…</div>}
      {!isLoading && (!purposes || purposes.length === 0) && (
        <div className="note">No purposes yet — add one above</div>
      )}

      {purposes?.map((p) => {
        const tags = p.tags ?? []
        return (
          <div key={p.id} className="card" style={{ marginTop: 12, padding: 12 }}>
            {editingId === p.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn" onClick={saveRename}>
                  Save
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>{p.name}</strong>
                <div>
                  <button
                    type="button"
                    className="pay-btn"
                    onClick={() => {
                      setEditingId(p.id)
                      setEditingName(p.name)
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" className="btn danger-link" onClick={() => deletePurpose.mutate(p.id)}>
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
                    onClick={() => removeTag(p.id, tags, tag)}
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
                value={tagDraft[p.id] ?? ''}
                onChange={(e) => setTagDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                onKeyDown={(e) => handleTagKeyDown(e, p.id, tags)}
                style={{ flex: 1 }}
              />
              <button type="button" className="pay-btn" onClick={() => addTag(p.id, tags)}>
                Add tag
              </button>
            </div>
          </div>
        )
      })}
    </details>
  )
}
