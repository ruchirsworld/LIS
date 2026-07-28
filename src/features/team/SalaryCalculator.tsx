import { Fragment, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useEmployees } from '../../lib/queries/masters'
import { useAttendance, useSalaryPayments, useSalaryAdjustments } from '../../lib/queries/team'
import { periodToRange, inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import { salaryPaid, salaryDue, salaryAdjustmentsTotal, daysInMonth } from '../../lib/calc/salary'
import { SalaryPaymentForm } from './SalaryPaymentForm'
import { SalaryPaymentEditForm } from './SalaryPaymentEditForm'
import { SalaryAdjustmentForm } from './SalaryAdjustmentForm'
import { SalaryAdjustmentEditForm } from './SalaryAdjustmentEditForm'

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7)
}

export function SalaryCalculator() {
  const { profile } = useAuth()
  const canWrite = profile?.role === 'admin' || profile?.role === 'cxo'
  const [month, setMonth] = useState(currentMonthStr())
  const { data: employees } = useEmployees()
  const range = periodToRange('month', { month })
  const { data: attendance } = useAttendance(range)
  const { data: payments } = useSalaryPayments()
  const { data: adjustments } = useSalaryAdjustments()
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const [adjFormId, setAdjFormId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null)

  if (profile?.role === 'staff') {
    return (
      <details className="toggle-section" open>
        <summary>Salary calculator</summary>
        <div className="note" style={{ marginTop: 16 }}>
          You don't have access to salary figures.
        </div>
      </details>
    )
  }

  const totalDays = daysInMonth(month)
  const cols = canWrite ? 10 : 9

  // Once an employee has left, stop calculating their salary from the
  // month after they left onward — but still show the month they actually
  // left in, since they were employed for at least part of it.
  const visibleEmployees = employees?.filter((emp) => emp.status !== 'left' || (emp.left_date && emp.left_date.slice(0, 7) >= month))

  return (
    <details className="toggle-section" open>
      <summary>Salary calculator</summary>

      <div className="field" style={{ marginTop: 16, maxWidth: 160 }}>
        <label>Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th style={{ textAlign: 'right' }}>Monthly salary</th>
              <th style={{ textAlign: 'right' }}>Allowances</th>
              <th style={{ textAlign: 'right' }}>Absent days</th>
              <th style={{ textAlign: 'right' }}>Attendance deduction</th>
              <th style={{ textAlign: 'right' }}>Adjustments</th>
              <th style={{ textAlign: 'right' }}>Net payable</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              {canWrite && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(!visibleEmployees || visibleEmployees.length === 0) && (
              <tr>
                <td colSpan={cols} className="empty-row">
                  No employees yet — add one under Admin → Employees.
                </td>
              </tr>
            )}
            {visibleEmployees?.map((emp) => {
              const hasSalary = emp.monthly_salary != null
              const salary = Number(emp.monthly_salary || 0)
              const allowances = Number(emp.fuel_allowance || 0) + Number(emp.other_allowance || 0)
              const absentDays =
                attendance?.filter((a) => a.employee_id === emp.id && a.status === 'absent').length ?? 0
              const attendanceDeduction = (salary / totalDays) * absentDays

              const empAdjustments = adjustments?.filter((a) => a.employee_id === emp.id && a.month === month) ?? []
              const adjustmentsTotal = salaryAdjustmentsTotal(empAdjustments)

              const net = salary + allowances - attendanceDeduction + adjustmentsTotal

              const empPayments =
                payments?.filter(
                  (p) => p.employee_id === emp.id && inRange(p.date, range?.from ?? null, range?.to ?? null),
                ) ?? []
              const paid = salaryPaid(empPayments)
              const due = salaryDue(net, empPayments)

              return (
                <Fragment key={emp.id}>
                  <tr>
                    <td>{emp.name}</td>
                    <td className="amt">{hasSalary ? fmt(salary) : '—'}</td>
                    <td className="amt">{allowances ? fmt(allowances) : '—'}</td>
                    <td className="amt">{absentDays}</td>
                    <td className="amt">{hasSalary && attendanceDeduction ? fmt(attendanceDeduction) : '—'}</td>
                    <td className="amt">
                      {adjustmentsTotal ? (adjustmentsTotal > 0 ? '+' : '−') + fmt(Math.abs(adjustmentsTotal)) : '—'}
                    </td>
                    <td className="amt">{hasSalary ? fmt(net) : '—'}</td>
                    <td className="amt">{fmt(paid)}</td>
                    <td className="amt">{hasSalary ? fmt(due) : '—'}</td>
                    {canWrite && (
                      <td>
                        {hasSalary && due > 0 && (
                          <button type="button" className="pay-btn" onClick={() => setPayFormId(emp.id)}>
                            Record payment
                          </button>
                        )}
                        <button type="button" className="pay-btn" onClick={() => setAdjFormId(emp.id)}>
                          Add adjustment
                        </button>
                        {empPayments.length > 0 && (
                          <div className="pay-history">
                            {empPayments.map((p) =>
                              editingPaymentId === p.id ? (
                                <SalaryPaymentEditForm
                                  key={p.id}
                                  payment={p}
                                  onClose={() => setEditingPaymentId(null)}
                                />
                              ) : (
                                <div key={p.id}>
                                  {p.display_id} — {p.date} — {fmt(p.amount)}
                                  {p.notes ? ` · ${p.notes}` : ''}{' '}
                                  <button type="button" className="pay-btn" onClick={() => setEditingPaymentId(p.id)}>
                                    Edit
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                        {empAdjustments.length > 0 && (
                          <div className="pay-history">
                            {empAdjustments.map((a) =>
                              editingAdjustmentId === a.id ? (
                                <SalaryAdjustmentEditForm
                                  key={a.id}
                                  adjustment={a}
                                  onClose={() => setEditingAdjustmentId(null)}
                                />
                              ) : (
                                <div key={a.id}>
                                  {a.display_id} — {a.amount > 0 ? '+' : '−'}
                                  {fmt(Math.abs(a.amount))}
                                  {a.notes ? ` · ${a.notes}` : ''}{' '}
                                  <button
                                    type="button"
                                    className="pay-btn"
                                    onClick={() => setEditingAdjustmentId(a.id)}
                                  >
                                    Edit
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {payFormId === emp.id && (
                    <SalaryPaymentForm
                      employeeId={emp.id}
                      due={due}
                      colSpan={cols}
                      onClose={() => setPayFormId(null)}
                    />
                  )}
                  {adjFormId === emp.id && (
                    <SalaryAdjustmentForm
                      employeeId={emp.id}
                      month={month}
                      colSpan={cols}
                      onClose={() => setAdjFormId(null)}
                    />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
