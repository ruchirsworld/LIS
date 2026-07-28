import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../../components/ui'
import { useExpenseCategories } from '../../lib/queries/masters'
import {
  useCreateExpenseCategory,
  useRenameExpenseCategory,
  useDeleteExpenseCategory,
  useUpdateExpenseCategoryTags,
} from '../../lib/queries/admin'

export function CoASection() {
  const { data: categories, isLoading } = useExpenseCategories()

  const createCategory = useCreateExpenseCategory()
  const renameCategory = useRenameExpenseCategory()
  const deleteCategory = useDeleteExpenseCategory()
  const updateTags = useUpdateExpenseCategoryTags()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  const [tagDraft, setTagDraft] = useState<Record<string, string>>({})

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!newCategoryName.trim()) {
      setFormError('Category name is required.')
      return
    }
    setSubmitting(true)
    try {
      await createCategory.mutateAsync(newCategoryName.trim())
      setNewCategoryName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add category.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveCategoryRename() {
    if (!editingCategoryId || !editingCategoryName.trim()) return
    await renameCategory.mutateAsync({ id: editingCategoryId, name: editingCategoryName.trim() })
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  async function addTag(categoryId: string, currentTags: string[]) {
    const draft = (tagDraft[categoryId] ?? '').trim()
    if (!draft || currentTags.includes(draft)) {
      setTagDraft((d) => ({ ...d, [categoryId]: '' }))
      return
    }
    await updateTags.mutateAsync({ id: categoryId, tags: [...currentTags, draft] })
    setTagDraft((d) => ({ ...d, [categoryId]: '' }))
  }

  async function removeTag(categoryId: string, currentTags: string[], tag: string) {
    await updateTags.mutateAsync({ id: categoryId, tags: currentTags.filter((t) => t !== tag) })
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>, categoryId: string, currentTags: string[]) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(categoryId, currentTags)
    }
  }

  return (
    <details className="toggle-section">
      <summary>CoA</summary>

      <form className="form-grid" onSubmit={handleAddCategory} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Category name</label>
          <input
            type="text"
            required
            placeholder="e.g. Materials"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add category'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      {isLoading && <div className="note">Loading…</div>}
      {!isLoading && (!categories || categories.length === 0) && (
        <div className="note">No categories yet — add one above</div>
      )}

      {categories?.map((cat) => {
        const tags = cat.tags ?? []
        return (
          <div key={cat.id} className="card" style={{ marginTop: 12, padding: 12 }}>
            {editingCategoryId === cat.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn" onClick={saveCategoryRename}>
                  Save
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditingCategoryId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>{cat.name}</strong>
                <div>
                  <button
                    type="button"
                    className="pay-btn"
                    onClick={() => {
                      setEditingCategoryId(cat.id)
                      setEditingCategoryName(cat.name)
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" className="btn danger-link" onClick={() => deleteCategory.mutate(cat.id)}>
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
                    onClick={() => removeTag(cat.id, tags, tag)}
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
                value={tagDraft[cat.id] ?? ''}
                onChange={(e) => setTagDraft((d) => ({ ...d, [cat.id]: e.target.value }))}
                onKeyDown={(e) => handleTagKeyDown(e, cat.id, tags)}
                style={{ flex: 1 }}
              />
              <button type="button" className="pay-btn" onClick={() => addTag(cat.id, tags)}>
                Add tag
              </button>
            </div>
          </div>
        )
      })}
    </details>
  )
}
