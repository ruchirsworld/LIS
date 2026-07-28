import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useEmployees } from '../../lib/queries/masters'
import { useCreateAttendance } from '../../lib/queries/team'
import { useAuth } from '../../lib/auth'

const STATUS_OPTIONS = [
  { value: 'absent', label: 'Absent' },
  { value: 'weeklyoff', label: 'Weekly off' },
  { value: 'holiday', label: 'Holiday' },
] as const

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceForm() {
  const { profile } = useAuth()
  const { data: employees } = useEmployees()
  const createAttendance = useCreateAttendance()

  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['value']>('absent')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!employeeId) {
      setFormError('Pick an employee.')
      return
    }
    setSubmitting(true)
    try {
      await createAttendance.mutateAsync({
        employee_id: employeeId,
        date,
        status,
        notes: notes.trim() || null,
      })
      setEmployeeId('')
      setDate(todayStr())
      setStatus('absent')
      setNotes('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log exception.')
    } finally {
      setSubmitting(false)
    }
  }

  if (profile?.role === 'staff') {
    return (
      <details className="toggle-section" open>
        <summary>Attendance exceptions</summary>
        <div className="note" style={{ marginTop: 16 }}>
          You have view-only access to Attendance.
        </div>
      </details>
    )
  }

  return (
    <details className="toggle-section" open>
      <summary>Attendance exceptions</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full at-employee">
          <label>Employee</label>
          <SearchableSelect
            items={employees}
            value={employeeId}
            onChange={setEmployeeId}
            getId={(emp) => emp.id}
            getLabel={(emp) => emp.name}
            placeholder="— Select employee —"
          />
        </div>

        <div className="field-row at-row2">
          <div className="field at-date">
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field at-status">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Logging…' : 'Log exception'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
