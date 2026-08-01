import { useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { fmt } from '../../lib/calc/format'
import { useDashboardKpis } from '../../lib/queries/dashboard'
import { useReportSummary } from '../../lib/queries/reports'
import { useProjects } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { dueAmount } from '../../lib/calc/invoices'
import { ReportPeriodFilter } from '../reports/ReportPeriodFilter'
import { FinancialSummaryReport } from '../reports/FinancialSummaryReport'
import { GstSummaryReport } from '../reports/GstSummaryReport'
import { ExpenseSummary } from './ExpenseSummary'
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
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()

  const completedPaymentPendingCount =
    projects
      ?.filter((p) => p.status === 'completed')
      .filter((p) => {
        const projectInvoices = invoices?.filter((i) => i.project_id === p.id) ?? []
        const totalDue = projectInvoices.reduce((sum, inv) => {
          const payments = invoicePayments?.filter((pm) => pm.invoice_id === inv.id) ?? []
          return sum + dueAmount(inv, payments)
        }, 0)
        return totalDue > 0.01
      }).length ?? 0

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
        <KpiCard label="Active projects" value={isLoading ? '—' : String(data?.active_projects ?? 0)} />
        <KpiCard
          label="Completed, payment pending"
          value={projectsLoading ? '—' : String(completedPaymentPendingCount)}
        />
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
      <ExpenseSummary range={range} />
    </div>
  )
}
