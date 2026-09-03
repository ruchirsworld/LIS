import { useState, type ComponentType } from 'react'
import { ModuleHeader } from '../../components/ui'
import { ReportPeriodFilter } from './ReportPeriodFilter'
import { ExpenseBreakdownReport } from './ExpenseBreakdownReport'
import { ClientReport } from './ClientReport'
import { VendorReport } from './VendorReport'
import { ProjectProfitabilityReport } from './ProjectProfitabilityReport'
import { LoanReport } from './LoanReport'
import { CapitalReport } from './CapitalReport'
import { CashBankReport } from './CashBankReport'
import { TripsReport } from './TripsReport'
import { FinancialSummaryReport } from './FinancialSummaryReport'
import { GstSummaryReport } from './GstSummaryReport'
import { TrialBalanceReport } from './TrialBalanceReport'
import {
  ClientLedgerReport,
  VendorLedgerReport,
  LoanLedgerReport,
  PartnerLedgerReport,
  SiteImprestLedgerReport,
  SalaryAdvanceLedgerReport,
} from './PartyLedgerReport'
import { AuditLogReport } from './AuditLogReport'
import { SegregationOfDutiesReport } from './SegregationOfDutiesReport'
import { reportPeriodToRange } from '../../lib/calc/reportPeriod'
import type { DateRange } from '../../lib/calc/reportPeriod'
import './Reports.css'

interface ReportDef {
  id: string
  title: string
  description: string
  Component: ComponentType<{ range: DateRange | null }>
  /** Doesn't respond to the period filter — a running snapshot instead of a
   * period report (e.g. Trial Balance), so the filter is hidden for it. */
  periodless?: boolean
}

interface ReportCategory {
  key: string
  label: string
  reports: ReportDef[]
}

const CATEGORIES: ReportCategory[] = [
  {
    key: 'overview',
    label: 'Financial overview',
    reports: [
      {
        id: 'financial-summary',
        title: 'Financial summary',
        description: 'Receipts, purchases, invoices due to send and interest due, at a glance.',
        Component: FinancialSummaryReport,
      },
      {
        id: 'gst-summary',
        title: 'GST summary',
        description: 'Output GST, input GST, net GST payable and TDS deducted.',
        Component: GstSummaryReport,
      },
      {
        id: 'trial-balance',
        title: 'Trial balance',
        description: 'Every GL account’s debit/credit totals and balance, as of now.',
        Component: TrialBalanceReport,
        periodless: true,
      },
    ],
  },
  {
    key: 'receivables',
    label: 'Sales & receivables',
    reports: [
      {
        id: 'client-report',
        title: 'Client report',
        description: 'Invoiced, received and outstanding due, by client.',
        Component: ClientReport,
      },
      {
        id: 'client-ledger',
        title: 'Client ledger',
        description: 'Every invoice and payment for one client, with a running balance.',
        Component: ClientLedgerReport,
        periodless: true,
      },
    ],
  },
  {
    key: 'payables',
    label: 'Purchases & payables',
    reports: [
      {
        id: 'vendor-report',
        title: 'Vendor report',
        description: 'Purchases, payments and outstanding due, by vendor.',
        Component: VendorReport,
      },
      {
        id: 'vendor-ledger',
        title: 'Vendor ledger',
        description: 'Every bill and payment for one vendor, with a running balance.',
        Component: VendorLedgerReport,
        periodless: true,
      },
      {
        id: 'expense-breakdown',
        title: 'Expense breakdown',
        description: 'Every expense record, grouped by cost center.',
        Component: ExpenseBreakdownReport,
      },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    reports: [
      {
        id: 'project-profitability',
        title: 'Project profitability',
        description: 'Invoiced vs. expenses and vendor bills, by project.',
        Component: ProjectProfitabilityReport,
      },
    ],
  },
  {
    key: 'cash-capital',
    label: 'Cash & capital',
    reports: [
      {
        id: 'cash-bank',
        title: 'Cash & bank',
        description: 'Money in, money out and running balance, by account.',
        Component: CashBankReport,
      },
      {
        id: 'capital-report',
        title: 'Capital report',
        description: 'Partner capital injected, withdrawn and net position.',
        Component: CapitalReport,
      },
      {
        id: 'partner-ledger',
        title: 'Partner ledger',
        description: 'Every capital injection and withdrawal for one partner, with a running balance.',
        Component: PartnerLedgerReport,
        periodless: true,
      },
      {
        id: 'loan-report',
        title: 'Loan report',
        description: 'Principal and interest paid, and outstanding, by lender.',
        Component: LoanReport,
      },
      {
        id: 'loan-ledger',
        title: 'Loan ledger',
        description: 'Every drawdown and principal repayment for one loan, with a running balance.',
        Component: LoanLedgerReport,
        periodless: true,
      },
    ],
  },
  {
    key: 'hr',
    label: 'HR & payroll',
    reports: [
      {
        id: 'site-imprest-ledger',
        title: 'Site imprest ledger',
        description: 'Every advance and return for one supervisor’s site float, with a running balance.',
        Component: SiteImprestLedgerReport,
        periodless: true,
      },
      {
        id: 'salary-advance-ledger',
        title: 'Salary advance ledger',
        description: 'Every advance and payroll recovery for one staff member, with a running balance.',
        Component: SalaryAdvanceLedgerReport,
        periodless: true,
      },
    ],
  },
  {
    key: 'audit',
    label: 'Audit & controls',
    reports: [
      {
        id: 'audit-log',
        title: 'Audit log',
        description: 'Every recorded edit and delete — who changed what, and what it looked like before.',
        Component: AuditLogReport,
        periodless: true,
      },
      {
        id: 'segregation-of-duties',
        title: 'Segregation of duties',
        description: 'Self-approved reimbursements and single-signature transactions above a threshold.',
        Component: SegregationOfDutiesReport,
        periodless: true,
      },
    ],
  },
  {
    key: 'trips',
    label: 'Trips',
    reports: [
      {
        id: 'trips-report',
        title: 'Trips',
        description: 'Every trip with total spend and status.',
        Component: TripsReport,
      },
    ],
  },
]

const ALL_REPORTS = CATEGORIES.flatMap((c) => c.reports)

export function ReportsPage() {
  const [range, setRange] = useState<DateRange | null>(reportPeriodToRange('month'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const selected = ALL_REPORTS.find((r) => r.id === selectedId) ?? null

  if (selected) {
    const { Component } = selected
    return (
      <div>
        <div className="report-detail-header">
          <button type="button" className="report-back-btn" onClick={() => setSelectedId(null)}>
            ← Reports
          </button>
          <h2 className="report-detail-title">{selected.title}</h2>
        </div>
        {!selected.periodless && <ReportPeriodFilter onChange={(r) => setRange(r)} />}
        <Component range={range} />
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    reports: q
      ? cat.reports.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
      : cat.reports,
  })).filter((cat) => cat.reports.length > 0)

  return (
    <div>
      <ModuleHeader>Reports</ModuleHeader>
      <input
        type="search"
        className="report-search"
        placeholder="Search reports…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filteredCategories.length === 0 && <div className="empty-row">No reports match "{query}"</div>}

      {filteredCategories.map((cat) => (
        <div key={cat.key} className="report-category">
          <div className="report-category-label">{cat.label}</div>
          <div className="report-hub-grid">
            {cat.reports.map((r) => (
              <button key={r.id} type="button" className="report-card" onClick={() => setSelectedId(r.id)}>
                <div className="report-card-title">{r.title}</div>
                <div className="report-card-desc">{r.description}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
