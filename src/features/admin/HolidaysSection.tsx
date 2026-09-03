import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '../../lib/queries/hr'
import { fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function HolidaysSection() {
  const { data: holidays, isLoading } = useHolidays()
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [date, setDate] = useState(todayStr())
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Give the holiday a name.')
      return
    }
    setSubmitting(true)
    try {
      await createHoliday.mutateAsync({ date, name: name.trim() })
      setName('')
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not add holiday — check the date isn’t already marked.'))
    } finally {
      setSubmitting(false)
    }
  }

  const upcoming = (holidays ?? []).filter((h) => h.date >= todayStr())
  const past = (holidays ?? []).filter((h) => h.date < todayStr())

  return (
    <details className="toggle-section">
      <summary>Company holidays</summary>
      <div className="note" style={{ marginTop: 16 }}>
        A holiday is a full-pay day for every staff member automatically in payroll — no per-staff marking needed.
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field field-narrow">
          <label>Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Name</label>
          <input type="text" required placeholder="e.g. Diwali" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add holiday'}
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
              <th>Date</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!holidays || holidays.length === 0) && (
              <tr>
                <td colSpan={3} className="empty-row">
                  No holidays added yet
                </td>
              </tr>
            )}
            {[...upcoming, ...past].map((h) => (
              <tr key={h.id}>
                <td>{fmtDate(h.date)}</td>
                <td>{h.name}</td>
                <td>
                  <button type="button" className="btn danger-link" onClick={() => deleteHoliday.mutate(h.id)}>
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
