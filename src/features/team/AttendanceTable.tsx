import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useAttendance, useDeleteAttendance } from '../../lib/queries/team'
import { useEmployees } from '../../lib/queries/masters'
import { useAuth } from '../../lib/auth'
import type { DateRange } from '../../lib/calc/period'

const STATUS_LABEL: Record<string, string> = {
  absent: 'Absent',
  half: 'Half day',
  leave: 'Leave',
  holiday: 'Holiday',
  weeklyoff: 'Weekly off',
}

export function AttendanceTable() {
  const { profile } = useAuth()
  const canWrite = profile?.role === 'admin' || profile?.role === 'cxo'
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: attendance, isLoading } = useAttendance(range)
  const { data: employees } = useEmployees()
  const deleteAttendance = useDeleteAttendance()

  return (
    <details className="toggle-section" open>
      <summary>Attendance records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee</th>
              <th>Date</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!attendance || attendance.length === 0) && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No exceptions logged in this period — everyone was present
                </td>
              </tr>
            )}
            {attendance?.map((a) => {
              const emp = employees?.find((e) => e.id === a.employee_id)
              return (
                <tr key={a.id}>
                  <td>{a.display_id ?? '—'}</td>
                  <td>{emp ? emp.name : '—'}</td>
                  <td>{a.date}</td>
                  <td>{STATUS_LABEL[a.status] ?? a.status}</td>
                  <td>{a.notes ?? '—'}</td>
                  <td>
                    {canWrite && (
                      <button
                        type="button"
                        className="btn danger-link"
                        onClick={() => deleteAttendance.mutate(a.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
