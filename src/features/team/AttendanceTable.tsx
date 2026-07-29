import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { useAttendance, useDeleteAttendance } from '../../lib/queries/team'
import { useEmployees } from '../../lib/queries/masters'
import { useAuth } from '../../lib/auth'
import { fmtDate } from '../../lib/calc/format'
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

  const employeeNameOf = (a: NonNullable<typeof attendance>[number]) =>
    employees?.find((e) => e.id === a.employee_id)?.name ?? ''

  const { sorted: sortedAttendance, sortKey, direction, toggleSort } = useSort(
    attendance,
    {
      id: (a) => a.display_id,
      employee: (a) => employeeNameOf(a),
      date: (a) => a.date,
      status: (a) => a.status,
      notes: (a) => a.notes,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedAttendance)

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
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Employee" sortKey="employee" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Notes" sortKey="notes" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
            {pageRows?.map((a) => {
              const empName = employeeNameOf(a)
              return (
                <tr key={a.id}>
                  <td>{a.display_id ?? '—'}</td>
                  <td>{empName || '—'}</td>
                  <td>{fmtDate(a.date)}</td>
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
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
