import { ModuleHeader } from '../../components/ui'
import { AttendanceForm } from './AttendanceForm'
import { AttendanceTable } from './AttendanceTable'
import { SalaryCalculator } from './SalaryCalculator'
import { TeamTrackerForm } from './TeamTrackerForm'
import { TeamTrackerTable } from './TeamTrackerTable'

export function TeamPage() {
  return (
    <div>
      <ModuleHeader>Team</ModuleHeader>
      <TeamTrackerForm />
      <AttendanceForm />
      <SalaryCalculator />
      <TeamTrackerTable />
      <AttendanceTable />
    </div>
  )
}
