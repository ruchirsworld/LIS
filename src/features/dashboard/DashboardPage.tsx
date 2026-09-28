import { useState, type CSSProperties } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { fmt, fmtDate } from '../../lib/calc/format'
import { useDashboardKpis } from '../../lib/queries/dashboard'
import { useReportSummary } from '../../lib/queries/reports'
import { useProjects, useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments, useOverdueInvoices } from '../../lib/queries/invoices'
import { useVendorBills } from '../../lib/queries/purchases'
import { useExpenses } from '../../lib/queries/expenses'
import { usePendingApprovalsCount } from '../../lib/queries/approvals'
import { useSiteImprestBalances } from '../../lib/queries/ledger'
import { useProfiles } from '../../lib/queries/admin'
import { dueAmount, netPayable } from '../../lib/calc/invoices'
import { projectExpenseTotal, projectVendorBillTotal } from '../../lib/calc/projects'
import { ReportPeriodFilter } from '../reports/ReportPeriodFilter'
import { FinancialSummaryReport } from '../reports/FinancialSummaryReport'
import { GstSummaryReport } from '../reports/GstSummaryReport'
import { ExpenseSummary } from './ExpenseSummary'
import { ReimbursementDue } from './ReimbursementDue'
import { SupervisorDashboardPage } from './SupervisorDashboardPage'
import { useAuth } from '../../lib/auth'
import { reportPeriodToRange } from '../../lib/calc/reportPeriod'
import { clientFullName } from '../../lib/labels'
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

const SECTION_LABEL: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 20, marginBottom: 8 }

type ExpandedKpi = 'approvals' | 'draftInvoices' | 'overdueInvoices' | 'imprest' | null

export function DashboardPage() {
  const { profile } = useAuth()
  const [range, setRange] = useState<DateRange | null>(reportPeriodToRange('month'))
  const [periodType, setPeriodType] = useState<ReportPeriodType>('month')
  const [expandedKpi, setExpandedKpi] = useState<ExpandedKpi>(null)
  const { data, isLoading, error } = useDashboardKpis()
  const { data: summary, isLoading: summaryLoading } = useReportSummary(range)
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()
  const { data: overdueInvoices } = useOverdueInvoices()
  const { data: pendingClaims } = useExpenses(null, 'pending')
  const { data: allExpenses } = useExpenses(null)
  const { data: vendorBills } = useVendorBills(null)
  const { data: profiles } = useProfiles()
  const { data: imprestBalances } = useSiteImprestBalances()
  const pendingApprovalsCount = usePendingApprovalsCount()

  if (profile?.role === 'supervisor') {
    return <SupervisorDashboardPage />
  }

  function toggleKpi(kpi: ExpandedKpi) {
    setExpandedKpi((cur) => (cur === kpi ? null : kpi))
  }

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

  const draftInvoices = (invoices ?? []).filter((i) => i.status === 'draft')
  const pendingProjectClaims = (pendingClaims ?? []).filter((e) => e.cost_center === 'Project')

  const activeProjects = (projects ?? []).filter((p) => p.status === 'active')
  const projectsOverBudgetCount = activeProjects.filter((p) => {
    if (!p.budget) return false
    const cost = projectExpenseTotal(p.id, allExpenses ?? []) + projectVendorBillTotal(p.id, vendorBills ?? [])
    return cost > p.budget
  }).length

  const clientName = (id: string | null) => clientFullName(clients?.find((c) => c.id === id))
  const supervisorName = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')

  const imprestRows = [...(imprestBalances?.entries() ?? [])]
    .map(([profileId, balance]) => ({ profileId, name: supervisorName(profileId), balance }))
    .filter((r) => r.balance > 0.01)
    .sort((a, b) => b.balance - a.balance)
  const totalImprestOutstanding = imprestRows.reduce((s, r) => s + r.balance, 0)

  return (
    <div>
      <ModuleHeader>Dashboard</ModuleHeader>
      <ReportPeriodFilter
        onChange={(r, type) => {
          setRange(r)
          setPeriodType(type)
        }}
      />

      <div style={{ ...SECTION_LABEL, marginTop: 16 }}>Needs attention</div>
      <div className="dash-grid">
        <KpiCard
          label="Pending approvals"
          value={String(pendingApprovalsCount)}
          onClick={() => toggleKpi('approvals')}
          active={expandedKpi === 'approvals'}
        />
        <KpiCard
          label="Invoices to send"
          value={String(draftInvoices.length)}
          onClick={() => toggleKpi('draftInvoices')}
          active={expandedKpi === 'draftInvoices'}
        />
        <KpiCard
          label="Overdue invoices"
          value={isLoading ? '—' : String(data?.overdue_invoices_count ?? 0)}
          onClick={() => toggleKpi('overdueInvoices')}
          active={expandedKpi === 'overdueInvoices'}
        />
      </div>

      {expandedKpi === 'approvals' &&
        (pendingProjectClaims.length === 0 ? (
          <div className="note" style={{ marginTop: 10 }}>
            Nothing waiting on approval.
          </div>
        ) : (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Supervisor</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingProjectClaims.map((e) => (
                  <tr key={e.id}>
                    <td>{supervisorName(e.created_by)}</td>
                    <td>{projectName(e.project_id)}</td>
                    <td>{fmtDate(e.date)}</td>
                    <td className="amt">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {expandedKpi === 'draftInvoices' &&
        (draftInvoices.length === 0 ? (
          <div className="note" style={{ marginTop: 10 }}>
            No draft invoices.
          </div>
        ) : (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {draftInvoices.map((i) => (
                  <tr key={i.id}>
                    <td>{clientName(i.client_id)}</td>
                    <td>{i.invoice_date ? fmtDate(i.invoice_date) : '—'}</td>
                    <td className="amt">{fmt(netPayable(i))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {expandedKpi === 'overdueInvoices' &&
        ((overdueInvoices ?? []).length === 0 ? (
          <div className="note" style={{ marginTop: 10 }}>
            No overdue invoices.
          </div>
        ) : (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Due date</th>
                  <th style={{ textAlign: 'right' }}>Due amount</th>
                </tr>
              </thead>
              <tbody>
                {(overdueInvoices ?? []).map((i) => (
                  <tr key={i.id}>
                    <td>{clientName(i.client_id)}</td>
                    <td>{i.effective_due_date ? fmtDate(i.effective_due_date) : '—'}</td>
                    <td className="amt" style={{ color: 'var(--red)' }}>
                      {fmt(i.due_amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <div style={SECTION_LABEL}>Position today — not affected by the period filter above</div>
      <div className="dash-grid">
        <KpiCard label="Cash & bank" value={isLoading ? '—' : fmt(data?.cash_and_bank_balance)} />
        <KpiCard label="Outstanding from clients" value={isLoading ? '—' : fmt(data?.outstanding_from_clients)} />
        <KpiCard label="Owed to vendors" value={isLoading ? '—' : fmt(data?.owed_to_vendors)} />
        <KpiCard label="Loan principal outstanding" value={isLoading ? '—' : fmt(data?.loan_principal_outstanding)} />
        <KpiCard
          label="Site imprest outstanding"
          value={fmt(totalImprestOutstanding)}
          onClick={() => toggleKpi('imprest')}
          active={expandedKpi === 'imprest'}
        />
      </div>

      {expandedKpi === 'imprest' &&
        (imprestRows.length === 0 ? (
          <div className="note" style={{ marginTop: 10 }}>
            No supervisor is currently holding any site imprest float.
          </div>
        ) : (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Supervisor</th>
                  <th style={{ textAlign: 'right' }}>Float held</th>
                </tr>
              </thead>
              <tbody>
                {imprestRows.map((r) => (
                  <tr key={r.profileId}>
                    <td>{r.name}</td>
                    <td className="amt">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <div style={SECTION_LABEL}>This period ({PERIOD_LABEL[periodType]})</div>
      <div className="dash-grid">
        <KpiCard label="Revenue received" value={summaryLoading ? '—' : fmt(summary?.total_received)} />
        <KpiCard label="Expenses" value={summaryLoading ? '—' : fmt(summary?.total_expenses)} />
        <KpiCard label="Vendor purchases" value={summaryLoading ? '—' : fmt(summary?.vendor_purchases)} />
        <KpiCard
          label="Net GST payable"
          value={summaryLoading ? '—' : fmt((summary?.output_gst ?? 0) - (summary?.input_gst ?? 0))}
        />
      </div>

      <div style={SECTION_LABEL}>Projects</div>
      <div className="dash-grid">
        <KpiCard label="Active projects" value={isLoading ? '—' : String(data?.active_projects ?? 0)} />
        <KpiCard label="Projects over budget" value={projectsLoading ? '—' : String(projectsOverBudgetCount)} />
        <KpiCard
          label="Completed, payment pending"
          value={projectsLoading ? '—' : String(completedPaymentPendingCount)}
        />
      </div>

      {error && (
        <div className="note" style={{ color: 'var(--red)' }}>
          Could not load dashboard: {(error as Error).message}
        </div>
      )}

      <FinancialSummaryReport range={range} />
      <GstSummaryReport range={range} />
      <ReimbursementDue />
      <ExpenseSummary range={range} />
    </div>
  )
}
