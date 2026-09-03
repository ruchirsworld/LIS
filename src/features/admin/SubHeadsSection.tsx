import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useExpenseSubHeads } from '../../lib/queries/masters'
import {
  useCreateExpenseSubHead,
  useRenameExpenseSubHead,
  useDeleteExpenseSubHead,
} from '../../lib/queries/admin'

/** The 10 major heads are a fixed chart of accounts — not admin-addable —
 * so a group still shows (with an empty state) even before it has any
 * sub-heads, and "Add sub-head" always has somewhere to file under. */
const MAJOR_HEADS = [
  { code: 10, name: 'Employee & Labour Costs' },
  { code: 20, name: 'Materials & Consumables' },
  { code: 30, name: 'Equipment & Machinery' },
  { code: 40, name: 'Transportation & Logistics' },
  { code: 50, name: 'Office & Administration' },
  { code: 60, name: 'Site / Project Overheads' },
  { code: 70, name: 'Business Development & Marketing' },
  { code: 80, name: 'Professional & Statutory' },
  { code: 90, name: 'Finance & Banking' },
  { code: 100, name: 'General / Miscellaneous' },
]

export function SubHeadsSection() {
  const { data: subHeads, isLoading } = useExpenseSubHeads()
  const createSubHead = useCreateExpenseSubHead()
  const renameSubHead = useRenameExpenseSubHead()
  const deleteSubHead = useDeleteExpenseSubHead()

  const [newMajorHead, setNewMajorHead] = useState<number | ''>('')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (newMajorHead === '') {
      setFormError('Pick a major head.')
      return
    }
    if (!newName.trim()) {
      setFormError('Sub-head name is required.')
      return
    }
    const majorHead = MAJOR_HEADS.find((h) => h.code === newMajorHead)
    if (!majorHead) return
    setSubmitting(true)
    try {
      await createSubHead.mutateAsync({ majorHeadCode: majorHead.code, majorHead: majorHead.name, name: newName.trim() })
      setNewName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add sub-head.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveRename() {
    if (!editingId || !editingName.trim()) return
    await renameSubHead.mutateAsync({ id: editingId, name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
  }

  return (
    <details className="toggle-section">
      <summary>Chart of accounts</summary>

      <form className="form-grid" onSubmit={handleAdd} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Major head</label>
          <SearchableSelect
            items={MAJOR_HEADS}
            value={newMajorHead === '' ? '' : String(newMajorHead)}
            onChange={(v) => setNewMajorHead(v === '' ? '' : Number(v))}
            getId={(h) => String(h.code)}
            getLabel={(h) => h.name}
            placeholder="— Select major head —"
          />
        </div>
        <div className="field">
          <label>Sub-head name</label>
          <input
            type="text"
            required
            placeholder="e.g. Site Security"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add sub-head'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      {isLoading && <div className="note">Loading…</div>}

      {MAJOR_HEADS.map((head) => {
        const items = (subHeads ?? []).filter((s) => s.major_head_code === head.code)
        return (
          <div key={head.code} style={{ marginTop: 20 }}>
            <div className="note" style={{ fontWeight: 600, color: 'var(--ink, inherit)', marginBottom: 8 }}>
              {head.code} — {head.name}
            </div>
            {items.length === 0 && <div className="note">No sub-heads yet</div>}
            {items.map((s) => {
              return (
                <div key={s.id} className="card" style={{ marginTop: 8, padding: 12 }}>
                  {editingId === s.id ? (
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
                      <span>
                        <span className="note" style={{ marginRight: 8 }}>
                          {s.code}
                        </span>
                        <strong>{s.name}</strong>
                      </span>
                      <div>
                        <button
                          type="button"
                          className="pay-btn"
                          onClick={() => {
                            setEditingId(s.id)
                            setEditingName(s.name)
                          }}
                        >
                          Rename
                        </button>
                        <button type="button" className="btn danger-link" onClick={() => deleteSubHead.mutate(s.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </details>
  )
}
