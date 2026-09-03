import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useStaff, useProjects } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useAllStaffAttendance, useAllStaffProjectAssignments } from '../../lib/queries/teamTracking'
import { TeamCalendarSection } from '../dashboard/TeamCalendarSection'
import { SiteWorkCalendarSection } from './SiteWorkCalendarSection'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Admin/CXO default to a company-wide view of which site had work done on
// which date — picking a supervisor switches it to that team's attendance
// calendar instead. A Supervisor sees their own team's attendance
// automatically, same split as Settings → HR → Attendance.
export function CalendarPage() {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const today = todayStr()

  const { data: staff } = useStaff()
  const { data: profiles } = useProfiles()
  const { data: allAttendance } = useAllStaffAttendance()
  const { data: projects } = useProjects()
  const { data: allAssignments } = useAllStaffProjectAssignments()

  const [supervisorId, setSupervisorId] = useState('')
  const supervisors = (profiles ?? []).filter((p) => p.role === 'supervisor')

  const effectiveSupervisorId = isSupervisor ? profile?.id ?? '' : supervisorId
  const team = (staff ?? []).filter(
    (s) => s.supervisor_id === effectiveSupervisorId && s.start_date <= today && (!s.end_date || s.end_date >= today)
  )

  return (
    <div>
      <ModuleHeader>Calendar</ModuleHeader>

      {!isSupervisor && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
          <label>Supervisor</label>
          <SearchableSelect
            items={supervisors}
            value={supervisorId}
            onChange={setSupervisorId}
            getId={(p) => p.id}
            getLabel={(p) => p.name}
            placeholder="— All sites (pick a supervisor for attendance) —"
          />
        </div>
      )}

      {!effectiveSupervisorId ? (
        <SiteWorkCalendarSection
          staff={staff ?? []}
          assignments={allAssignments ?? []}
          projects={projects ?? []}
          supervisors={supervisors}
        />
      ) : team.length === 0 ? (
        <div className="note">No team members assigned to this supervisor.</div>
      ) : (
        <TeamCalendarSection
          team={team}
          attendance={allAttendance ?? []}
          assignments={allAssignments ?? []}
          projects={projects ?? []}
        />
      )}
    </div>
  )
}
