import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useExpenseUnits } from '../../lib/queries/masters'
import { useCreateExpenseUnit, useDeleteExpenseUnit } from '../../lib/queries/admin'

/** Units of measure for the Projects cost center's Qty x Rate breakdown —
 * a short flat list, no tags, name-only (mirrors the old plain CoA list). */
export function UnitsSection() {
  const { data: units, isLoading } = useExpenseUnits()
  const createUnit = useCreateExpenseUnit()
  const deleteUnit = useDeleteExpenseUnit()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Unit name is required.')
      return
    }
    setSubmitting(true)
    try {
      await createUnit.mutateAsync(name.trim())
      setName('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add unit.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Units</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Name</label>
          <input type="text" required placeholder="e.g. Kg, Ltr, Days" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add unit'}
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
          <tbody>
            {isLoading && (
              <tr>
                <td className="empty-row">Loading…</td>
              </tr>
            )}
            {!isLoading && (!units || units.length === 0) && (
              <tr>
                <td className="empty-row">None yet — add one above</td>
              </tr>
            )}
            {units?.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>
                  <button type="button" className="btn danger-link" onClick={() => deleteUnit.mutate(u.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
