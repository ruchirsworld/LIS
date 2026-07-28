import { useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { fmt } from '../../lib/calc/format'
import { useDashboardKpis } from '../../lib/queries/dashboard'
import { useReportSummary } from '../../lib/queries/reports'
import { ReportPeriodFilter } from '../reports/ReportPeriodFilter'
import { FinancialSummaryReport } from '../reports/FinancialSummaryReport'
import { GstSummaryReport } from '../reports/GstSummaryReport'
import { GeneralExpenseSummary } from './GeneralExpenseSummary'
import { reportPeriodToRange } from '../../lib/calc/reportPeriod'
import type { DateRange, ReportPeriodType } from '../../lib/calc/reportPeriod'

const PERIOD_LABEL: Record<ReportPeriodType, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  quarter: 'this quarter',
  year: 'this year',
  all: 'all time',
  custom: 'selected range',
}

export function DashboardPage() {
  const [range, setRange] = useState<DateRange | null>(reportPeriodToRange('month'))
  const [periodType, setPeriodType] = useState<ReportPeriodType>('month')
  const { data, isLoading, error } = useDashboardKpis()
  const { data: summary, isLoading: summaryLoading } = useReportSummary(range)

  return (
    <div>
      <ModuleHeader>Dashboard</ModuleHeader>
      <ReportPeriodFilter
        onChange={(r, type) => {
          setRange(r)
          setPeriodType(type)
        }}
      />
      <div className="dash-grid">
        <KpiCard label="Outstanding from clients" value={isLoading ? '—' : fmt(data?.outstanding_from_clients)} />
        <KpiCard
          label={`Expenses (${PERIOD_LABEL[periodType]})`}
          value={summaryLoading ? '—' : fmt(summary?.total_expenses)}
        />
        <KpiCard label="Owed to vendors" value={isLoading ? '—' : fmt(data?.owed_to_vendors)} />
        <KpiCard label="Loan principal outstanding" value={isLoading ? '—' : fmt(data?.loan_principal_outstanding)} />
      </div>
      {error && (
        <div className="note" style={{ color: 'var(--red)' }}>
          Could not load dashboard: {(error as Error).message}
        </div>
      )}

      <FinancialSummaryReport range={range} />
      <GstSummaryReport range={range} />
      <GeneralExpenseSummary range={range} />
    </div>
  )
}
