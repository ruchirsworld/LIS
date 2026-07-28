import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui'

interface NamedItem {
  id: string
  name: string
}

export function SimpleListSection({
  summary,
  items,
  isLoading,
  onCreate,
  onRename,
  onDelete,
  createLabel,
  namePlaceholder,
  note,
  defaultOpen,
}: {
  summary: string
  items: NamedItem[] | undefined
  isLoading: boolean
  onCreate: (name: string) => Promise<unknown>
  onRename: (id: string, name: string) => Promise<unknown>
  onDelete: (id: string) => void
  createLabel: string
  namePlaceholder?: string
  note: ReactNode
  defaultOpen?: boolean
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    setSubmitting(true)
    try {
      await onCreate(name.trim())
      setName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add.')
    } finally {
      setSubmitting(false)
    }
  }

  function startRename(item: NamedItem) {
    setEditingId(item.id)
    setEditingName(item.name)
  }

  async function saveRename() {
    if (!editingId || !editingName.trim()) return
    await onRename(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  return (
    <details className="toggle-section" open={defaultOpen}>
      <summary>{summary}</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Name</label>
          <input
            type="text"
            required
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : createLabel}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={2} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!items || items.length === 0) && (
              <tr>
                <td colSpan={2} className="empty-row">
                  None yet — add one above
                </td>
              </tr>
            )}
            {items?.map((item) =>
              editingId === item.id ? (
                <tr key={item.id}>
                  <td>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  </td>
                  <td>
                    <button type="button" className="btn" onClick={saveRename}>
                      Save
                    </button>
                    <button type="button" className="btn secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <button type="button" className="pay-btn" onClick={() => startRename(item)}>
                      Rename
                    </button>
                    <button type="button" className="btn danger-link" onClick={() => onDelete(item.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="note">{note}</div>
    </details>
  )
}
