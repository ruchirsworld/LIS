import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProfiles } from '../../lib/queries/admin'
import { SupervisorProjectExpenseForm } from '../expenses/SupervisorProjectExpenseForm'

// Lets an Admin/CXO phone in a claim for a supervisor who can't enter it
// themselves — same form a supervisor fills in on their own Expenses tab,
// just picking who it's for first. Submits under that supervisor's name.
export function SupervisorEntryPage() {
  const { data: profiles } = useProfiles()
  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')
  const [supervisorId, setSupervisorId] = useState('')

  return (
    <div>
      <ModuleHeader>Supervisor</ModuleHeader>

      <div className="form-row">
        <div className="field">
          <label>Supervisor</label>
          <SearchableSelect
            items={supervisors}
            value={supervisorId}
            onChange={setSupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— Select supervisor —"
          />
        </div>
      </div>

      {supervisorId && (
        <div style={{ marginTop: 16 }}>
          <SupervisorProjectExpenseForm actingAsProfileId={supervisorId} />
        </div>
      )}
    </div>
  )
}
