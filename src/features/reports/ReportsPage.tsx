import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { ReportPeriodFilter } from './ReportPeriodFilter'
import { ExpenseBreakdownReport } from './ExpenseBreakdownReport'
import { ClientReport } from './ClientReport'
import { VendorReport } from './VendorReport'
import { ProjectProfitabilityReport } from './ProjectProfitabilityReport'
import { TeamSalaryReport } from './TeamSalaryReport'
import { LoanReport } from './LoanReport'
import { CapitalReport } from './CapitalReport'
import { CashBankReport } from './CashBankReport'
import { reportPeriodToRange } from '../../lib/calc/reportPeriod'
import type { DateRange } from '../../lib/calc/reportPeriod'

export function ReportsPage() {
  const [range, setRange] = useState<DateRange | null>(reportPeriodToRange('month'))

  return (
    <div>
      <ModuleHeader>Reports</ModuleHeader>
      <ReportPeriodFilter onChange={(r) => setRange(r)} />

      <ExpenseBreakdownReport range={range} />
      <ClientReport range={range} />
      <VendorReport range={range} />
      <ProjectProfitabilityReport range={range} />
      <TeamSalaryReport range={range} />
      <LoanReport range={range} />
      <CapitalReport range={range} />
      <CashBankReport range={range} />
    </div>
  )
}
