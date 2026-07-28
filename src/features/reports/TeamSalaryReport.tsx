import { useAuth } from '../../lib/auth'
import { useEmployees } from '../../lib/queries/masters'
import { useAttendance, useSalaryPayments, useSalaryAdjustments } from '../../lib/queries/team'
import { salaryPaid, salaryAdjustmentsTotal } from '../../lib/calc/salary'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function TeamSalaryReport({ range }: { range: DateRange | null }) {
  const { profile } = useAuth()
  const { data: employees } = useEmployees()
  const { data: attendance } = useAttendance(range)
  const { data: payments } = useSalaryPayments()
  const { data: adjustments } = useSalaryAdjustments()

  if (profile?.role === 'staff') {
    return (
      <details className="toggle-section" open>
        <summary>Team & salary report</summary>
        <div className="note" style={{ marginTop: 16 }}>
          You don't have access to salary figures.
        </div>
      </details>
    )
  }

  const from = range?.from ?? null
  const to = range?.to ?? null

  const rows = (employees ?? []).map((emp) => {
    const absentDays = attendance?.filter((a) => a.employee_id === emp.id && a.status === 'absent').length ?? 0

    const empPayments = (payments ?? []).filter((p) => p.employee_id === emp.id && inRange(p.date, from, to))
    const paid = salaryPaid(empPayments)

    const empAdjustments = (adjustments ?? []).filter((a) => {
      if (a.employee_id !== emp.id) return false
      if (from && a.month < from.slice(0, 7)) return false
      if (to && a.month > to.slice(0, 7)) return false
      return true
    })
    const adjustmentsTotal = salaryAdjustmentsTotal(empAdjustments)

    return { id: emp.id, name: emp.name, absentDays, paid, adjustmentsTotal }
  })

  const sections: ExportSection[] = [
    {
      title: 'Team & salary report',
      columns: ['Employee', 'Absent days', 'Salary paid', 'Adjustments'],
      rows: rows.map((r) => [r.name, r.absentDays, r.paid, r.adjustmentsTotal]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Team & salary report</summary>
      <ReportExportButtons title="Team & salary report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th style={{ textAlign: 'right' }}>Absent days</th>
              <th style={{ textAlign: 'right' }}>Salary paid</th>
              <th style={{ textAlign: 'right' }}>Adjustments</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No employees yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="amt">{r.absentDays}</td>
                <td className="amt">{fmt(r.paid)}</td>
                <td className="amt">
                  {r.adjustmentsTotal ? (r.adjustmentsTotal > 0 ? '+' : '−') + fmt(Math.abs(r.adjustmentsTotal)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
