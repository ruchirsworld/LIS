import { useAuth } from '../../lib/auth'
import { KpiCard } from '../../components/ui'
import { useReportSummary } from '../../lib/queries/reports'
import { useInvoices } from '../../lib/queries/invoices'
import { useLoans, useLoanPayments } from '../../lib/queries/loans'
import { useEmployees, usePartners } from '../../lib/queries/masters'
import { useAttendance, useSalaryPayments, useSalaryAdjustments } from '../../lib/queries/team'
import { useCapitalTx } from '../../lib/queries/capital'
import { fmt } from '../../lib/calc/format'
import { netPayable } from '../../lib/calc/invoices'
import { totalInterestDue } from '../../lib/calc/loans'
import { salaryDue, salaryAdjustmentsTotal, daysInMonth, monthsInRange } from '../../lib/calc/salary'
import { partnerNet } from '../../lib/calc/capital'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function FinancialSummaryReport({ range }: { range: DateRange | null }) {
  const { profile } = useAuth()
  const canSeeSalary = profile?.role !== 'staff'

  const { data: summary } = useReportSummary(range)

  const { data: invoices } = useInvoices(range)
  const { data: loans } = useLoans(null)
  const { data: loanPayments } = useLoanPayments()
  const { data: employees } = useEmployees()
  const { data: attendance } = useAttendance(range)
  const { data: salaryPayments } = useSalaryPayments()
  const { data: salaryAdjustments } = useSalaryAdjustments()
  const { data: partners } = usePartners()
  const { data: capitalTx } = useCapitalTx(null)

  // Draft invoices raised in this period still need sending.
  let invoiceDueToSend = 0
  invoices?.forEach((inv) => {
    if (inv.status === 'draft') invoiceDueToSend += netPayable(inv)
  })

  // Loans are running balances, not tied to a period — accrued-unpaid
  // interest as of today, across every loan.
  let interestDue = 0
  loans?.forEach((loan) => {
    const payments = loanPayments?.filter((p) => p.loan_id === loan.id) ?? []
    interestDue += totalInterestDue(loan, payments)
  })

  // Salary is inherently monthly — sum Net payable/Due across every calendar
  // month the selected period touches (see monthsInRange for the "All time"
  // fallback).
  let totalSalary = 0
  let salaryDueTotal = 0
  if (canSeeSalary) {
    for (const month of monthsInRange(range?.from ?? null, range?.to ?? null)) {
      const totalDays = daysInMonth(month)
      const monthStart = `${month}-01`
      const monthEnd = `${month}-${String(totalDays).padStart(2, '0')}`
      employees?.forEach((emp) => {
        if (emp.monthly_salary == null) return
        const salary = Number(emp.monthly_salary || 0)
        const allowances = Number(emp.fuel_allowance || 0) + Number(emp.other_allowance || 0)
        const absentDays =
          attendance?.filter(
            (a) => a.employee_id === emp.id && a.status === 'absent' && a.date.slice(0, 7) === month,
          ).length ?? 0
        const attendanceDeduction = (salary / totalDays) * absentDays
        const empAdjustments = salaryAdjustments?.filter((a) => a.employee_id === emp.id && a.month === month) ?? []
        const net = salary + allowances - attendanceDeduction + salaryAdjustmentsTotal(empAdjustments)
        const empPayments =
          salaryPayments?.filter((p) => p.employee_id === emp.id && p.date >= monthStart && p.date <= monthEnd) ?? []
        totalSalary += net
        salaryDueTotal += salaryDue(net, empPayments)
      })
    }
  }

  // Capital positions are running balances too, not period-scoped.
  const partnerRows = (partners ?? []).map((p) => {
    const { injected, withdrawn } = partnerNet(p.id, capitalTx ?? [])
    return { id: p.id, name: p.name, net: withdrawn - injected }
  })

  const metrics: [string, number][] = [
    ['Total received', summary?.total_received ?? 0],
    ['Invoice due (to send)', invoiceDueToSend],
    ['Total purchases', summary?.vendor_purchases ?? 0],
    ['Interest due', interestDue],
    ...(canSeeSalary
      ? ([
          ['Total salary', totalSalary],
          ['Salary due', salaryDueTotal],
        ] as [string, number][])
      : []),
  ]

  const sections: ExportSection[] = [
    { title: 'Financial summary', columns: ['Metric', 'Amount'], rows: metrics.map(([m, v]) => [m, v]) },
    ...(partnerRows.length
      ? [
          {
            title: 'Capital (withdrawn − injected)',
            columns: ['Partner', 'Amount'],
            rows: partnerRows.map((p): [string, number] => [p.name, p.net]),
          },
        ]
      : []),
  ]

  return (
    <details className="toggle-section" open>
      <summary>Financial summary</summary>
      <ReportExportButtons title="Financial summary" sections={sections} range={range} />
      <div className="dash-grid" style={{ marginTop: 16 }}>
        {metrics.map(([label, value]) => (
          <KpiCard key={label} label={label} value={fmt(value)} />
        ))}
        {partnerRows.map((p) => (
          <KpiCard key={p.id} label={`${p.name} (withdrawn − injected)`} value={fmt(p.net)} />
        ))}
      </div>
    </details>
  )
}
