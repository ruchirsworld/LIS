import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useExpenseCategories } from '../../lib/queries/masters'
import { useCreateExpenseCategory, useRenameExpenseCategory, useDeleteExpenseCategory } from '../../lib/queries/admin'

export function CoASection() {
  const { data: categories, isLoading } = useExpenseCategories()

  const createCategory = useCreateExpenseCategory()
  const renameCategory = useRenameExpenseCategory()
  const deleteCategory = useDeleteExpenseCategory()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

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
          </div>
        )
      })}
    </details>
  )
}
