import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useCreateStaff, useUpdateStaff, useProfiles } from '../../lib/queries/admin'
import { useProjects } from '../../lib/queries/masters'
import { useAuth } from '../../lib/auth'
import { parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import type { Database } from '../../types/database'

type Staff = Database['public']['Tables']['staff']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function StaffForm({
  editingStaff,
  onDoneEditing,
}: {
  editingStaff: Staff | null
  onDoneEditing: () => void
}) {
  const { profile } = useAuth()
  const canAdd = profile?.role === 'admin' || profile?.role === 'cxo'
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()

  const [name, setName] = useState(editingStaff?.name ?? '')
  const [phone, setPhone] = useState(editingStaff?.phone ?? '')
  const [dailyRate, setDailyRate] = useState(editingStaff ? String(editingStaff.daily_rate) : '0')
  const [supervisorId, setSupervisorId] = useState(editingStaff?.supervisor_id ?? '')
  const [defaultProjectId, setDefaultProjectId] = useState(editingStaff?.default_project_id ?? '')
  const [startDate, setStartDate] = useState(editingStaff?.start_date ?? todayStr())
  const [endDate, setEndDate] = useState(editingStaff?.end_date ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setPhone('')
    setDailyRate('0')
    setSupervisorId('')
    setDefaultProjectId('')
    setStartDate(todayStr())
    setEndDate('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Staff name is required.')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        name: name.trim(),
        phone: phone.trim() || null,
        daily_rate: parseINR(dailyRate) || 0,
        supervisor_id: supervisorId || null,
        default_project_id: defaultProjectId || null,
        start_date: startDate,
        end_date: endDate || null,
      }
      if (editingStaff) {
        await updateStaff.mutateAsync({ id: editingStaff.id, patch })
        onDoneEditing()
      } else {
        await createStaff.mutateAsync(patch)
        resetForm()
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save staff member.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!editingStaff && !canAdd) {
    return <div className="note">Only Admin and CXO accounts can add new staff.</div>
  }

  return (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Daily rate (₹)</label>
          <CurrencyInput value={dailyRate} onValueChange={setDailyRate} />
        </div>
        <div className="field">
          <label>Supervisor (optional)</label>
          <SearchableSelect
            items={profiles}
            value={supervisorId}
            onChange={setSupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— No supervisor —"
          />
        </div>
        <div className="field">
          <label>Default project (optional)</label>
          <SearchableSelect
            items={projects}
            value={defaultProjectId}
            onChange={setDefaultProjectId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— No default project —"
          />
        </div>
        <div className="field">
          <label>Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>End date (optional)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingStaff ? 'Save changes' : 'Add staff'}
          </Button>
          {editingStaff && (
            <Button type="button" variant="secondary" onClick={onDoneEditing}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )
}
