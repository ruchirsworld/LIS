import { activateProps } from '../../lib/a11y'
import { Fragment, useState, type ReactNode } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Button, ModuleHeader, KpiCard, type KpiTone } from '../../components/ui'
import { fmt, fmtDate } from '../../lib/calc/format'
import { useDashboardKpis } from '../../lib/queries/dashboard'
import { useReportSummary } from '../../lib/queries/reports'
import { useProjects, useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments, useOverdueInvoices } from '../../lib/queries/invoices'
import { useVendorBills } from '../../lib/queries/purchases'
import { useExpenses } from '../../lib/queries/expenses'
import { usePendingApprovalsCount } from '../../lib/queries/approvals'
import { useCashMovements, useSiteImprestBalances } from '../../lib/queries/ledger'
import { useBooksHealth } from '../../lib/queries/books'
import { useProfiles } from '../../lib/queries/admin'
import { dueAmount, gstHeld, netPayable, retentionHeld } from '../../lib/calc/invoices'
import { projectExpenseTotal, projectVendorBillTotal } from '../../lib/calc/projects'
import { ReportPeriodFilter } from '../reports/ReportPeriodFilter'
import { FinancialSummaryReport } from '../reports/FinancialSummaryReport'
import { GstSummaryReport } from '../reports/GstSummaryReport'
import { InvoicePaymentForm } from '../invoices/InvoicePaymentForm'
import { ExpenseSummary } from './ExpenseSummary'
import { ReimbursementDue } from './ReimbursementDue'
import { SupervisorDashboardPage } from './SupervisorDashboardPage'
import { DashSection, useDashSections, type DashSectionId } from './DashSection'
import { DashboardInsights } from './DashboardInsights'
import { ClaimActions, SendInvoiceAction } from './DashActions'
import { Delta, ProgressBar, Sparkline } from './dashViz'
import { useAuth } from '../../lib/auth'
import { useGoTo, type NavFilter } from '../../lib/navContext'
import type { TabId } from '../../lib/nav'
import { previousPeriodLabel, previousRange, reportPeriodToRange } from '../../lib/calc/reportPeriod'
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

const JUMP_LINKS: { id: DashSectionId; label: string }[] = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'position', label: 'Position today' },
  { id: 'period', label: 'This period' },
  { id: 'projects', label: 'Projects' },
  { id: 'insights', label: 'Trends' },
  { id: 'reports', label: 'Reports' },
]

type ExpandedKpi = 'approvals' | 'draftInvoices' | 'overdueInvoices' | 'outstanding' | 'retention' | 'gstHeld' | 'imprest' | 'gst' | null

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function DashboardPage() {
  const { profile } = useAuth()
  const goTo = useGoTo()
  const queryClient = useQueryClient()
  const fetchingCount = useIsFetching()
  const sections = useDashSections()
  const [range, setRange] = useState<DateRange | null>(reportPeriodToRange('month'))
  const [periodType, setPeriodType] = useState<ReportPeriodType>('month')
  const [expandedKpi, setExpandedKpi] = useState<ExpandedKpi>(null)
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const { data, isLoading, error, dataUpdatedAt } = useDashboardKpis()
  const { data: summary, isLoading: summaryLoading } = useReportSummary(range)
  const prevRange = previousRange(range, periodType)
  const { data: prevSummary } = useReportSummary(prevRange, prevRange !== null)
  const { data: cashMovements } = useCashMovements(30)
  const { data: booksHealth, isLoading: booksHealthLoading } = useBooksHealth()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()
  // Retention still held back by clients across every invoice — part of what
  // clients owe in total, but not of "Outstanding from clients" below, which
  // only counts what is collectible now.
  const totalGstHeld = (invoices ?? []).reduce(
    (s, inv) => s + gstHeld(inv, invoicePayments?.filter((p) => p.invoice_id === inv.id) ?? []),
    0
  )
  const totalRetentionHeld = (invoices ?? []).reduce(
    (s, inv) => s + retentionHeld(inv, invoicePayments?.filter((p) => p.invoice_id === inv.id) ?? []),
    0
  )
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

  // One peek table open at a time — opening another closes the current one.
  function toggleKpi(kpi: ExpandedKpi) {
    setExpandedKpi((cur) => (cur === kpi ? null : kpi))
  }

  // A card that opens another page, or a plain card when there is no shell
  // to navigate (nothing to click, so nothing pretends to be clickable).
  function drill(tab: TabId, filter?: NavFilter) {
    return goTo ? { onClick: () => goTo(tab, filter ? { filter } : undefined), go: true as const } : {}
  }

  // The dashboard's own period, as a preset for a list's date filter (none for
  // all time or an open-ended range).
  const periodRange = range?.from && range?.to ? { from: range.from, to: range.to } : undefined

  function jumpTo(id: DashSectionId) {
    sections.open(id)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() =>
      document.getElementById(`dash-${id}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    )
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

  // Per-client collectible due and held retention, for the two quick-peek tables.
  const clientBalances = (clients ?? [])
    .map((c) => {
      const invs = (invoices ?? []).filter((i) => i.client_id === c.id)
      const paymentsOf = (id: string) => invoicePayments?.filter((p) => p.invoice_id === id) ?? []
      return {
        id: c.id,
        name: clientFullName(c),
        due: invs.reduce((s, i) => s + dueAmount(i, paymentsOf(i.id)), 0),
        held: invs.reduce((s, i) => s + retentionHeld(i, paymentsOf(i.id)), 0),
        gstHeld: invs.reduce((s, i) => s + gstHeld(i, paymentsOf(i.id)), 0),
        // Of the held GST: filed but proof not yet sent, and proof sent but not yet released.
        gstProofToSend: invs.filter((i) => i.gstr3b_filed_on && !i.gstr3b_sent_on).reduce((s, i) => s + gstHeld(i, paymentsOf(i.id)), 0),
        gstAwaitingRelease: invs.filter((i) => i.gstr3b_sent_on).reduce((s, i) => s + gstHeld(i, paymentsOf(i.id)), 0),
      }
    })
    .filter((r) => r.due > 0.01 || r.held > 0.01 || r.gstHeld > 0.01)

  // Status colour for a count that should be zero: red/amber when something
  // is waiting, green when all clear; nothing while still loading.
  function countTone(count: number, loading: boolean, whenOpen: KpiTone): KpiTone | undefined {
    if (loading) return undefined
    return count > 0 ? whenOpen : 'good'
  }
  function countSub(count: number, loading: boolean, waiting: string): string | undefined {
    if (loading) return undefined
    return count > 0 ? waiting : 'All clear'
  }

  const booksToFix = (booksHealth ?? []).filter((c) => c.severity === 'error').length
  const booksToReview = (booksHealth ?? []).filter((c) => c.severity === 'warning').length
  const overdueCount = data?.overdue_invoices_count ?? 0
  const overdueAmount = data?.overdue_invoices_amount ?? 0
  const outstandingAmount = data?.outstanding_from_clients ?? 0

  // Cash & bank over the last 30 days, worked back from today's balance: each
  // day's closing balance is the next day's closing minus that day's net movement.
  const cashSeries = (() => {
    if (!cashMovements || data?.cash_and_bank_balance == null) return null
    const netByDate = new Map(cashMovements.map((m) => [m.date, m.net]))
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = new Date()
    const days: string[] = []
    for (let i = 30; i >= 0; i--) days.push(iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)))
    const todayISO = days[days.length - 1]
    // The balance includes any future-dated entries — back them out first.
    let balance = Number(data.cash_and_bank_balance)
    for (const [date, net] of netByDate) if (date > todayISO) balance -= net
    const series: number[] = []
    for (let i = days.length - 1; i >= 0; i--) {
      series.unshift(balance)
      balance -= netByDate.get(days[i]) ?? 0
    }
    return series
  })()

  const comparedTo = previousPeriodLabel(periodType)
  const trend = (current: number | undefined, previous: number | undefined, goodWhen: 'up' | 'down' | 'neutral') =>
    prevSummary && previous !== undefined ? <Delta current={current ?? 0} previous={previous} goodWhen={goodWhen} label={comparedTo} /> : undefined

  const updatedAt = dataUpdatedAt ? clockTime(dataUpdatedAt) : null

  // Footer link of a peek table — the "see everything" step.
  function viewAll(tab: TabId, label: string, filter?: NavFilter): ReactNode {
    if (!goTo) return null
    return (
      <div className="dash-viewall">
        <Button type="button" variant="link" onClick={() => goTo(tab, filter ? { filter } : undefined)}>
          {label} {'→'}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <ModuleHeader>Dashboard</ModuleHeader>

      <div className="dash-bar">
        <ReportPeriodFilter
          onChange={(r, type) => {
            setRange(r)
            setPeriodType(type)
          }}
        />
        <nav className="dash-jump" aria-label="Jump to section">
          {JUMP_LINKS.map((l) => (
            <button key={l.id} type="button" className="dash-jump-chip" onClick={() => jumpTo(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>
        {updatedAt && <span className="dash-updated">Updated {updatedAt}</span>}
        <Button
          type="button"
          variant="secondary"
          className="dash-refresh"
          disabled={fetchingCount > 0}
          onClick={() => queryClient.invalidateQueries()}
        >
          {fetchingCount > 0 ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <DashSection id="attention" title="Needs attention" open={sections.isOpen('attention')} onToggle={() => sections.toggle('attention')}>
        <div className="dash-subhead">Supervisors &amp; site</div>
        <div className="dash-grid">
          <KpiCard
            label="Pending approvals"
            value={String(pendingApprovalsCount)}
            onClick={() => toggleKpi('approvals')}
            active={expandedKpi === 'approvals'}
            tone={countTone(pendingApprovalsCount, false, 'warn')}
            sub={countSub(pendingApprovalsCount, false, 'Waiting for your approval')}
            hint="Supervisor claims waiting for you. Click to review them here"
          />
          <KpiCard
            label="Site imprest outstanding"
            value={fmt(totalImprestOutstanding)}
            onClick={() => toggleKpi('imprest')}
            active={expandedKpi === 'imprest'}
            hint="Float held by supervisors. Click for the split by supervisor"
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProjectClaims.map((e) => (
                    <tr key={e.id} className={goTo ? 'row-link' : undefined} {...activateProps(goTo ? () => goTo('approvals', { filter: { supervisorId: e.created_by ?? undefined } }) : undefined)}>
                      <td>{supervisorName(e.created_by)}</td>
                      <td>{projectName(e.project_id)}</td>
                      <td>{fmtDate(e.date)}</td>
                      <td className="amt">{fmt(e.amount)}</td>
                      <td>
                        <ClaimActions expense={e} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewAll('approvals', 'Open Approvals')}
            </div>
          ))}

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
                    <tr key={r.profileId} className={goTo ? 'row-link' : undefined} {...activateProps(goTo ? () => goTo('hr', { filter: { hrSection: 'Imprest' } }) : undefined)}>
                      <td>{r.name}</td>
                      <td className="amt">{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewAll('hr', 'Open Imprest in HR', { hrSection: 'Imprest' })}
            </div>
          ))}
        <div className="dash-subhead">Invoices</div>
        <div className="dash-grid">
          <KpiCard
            label="Invoices to send"
            value={String(draftInvoices.length)}
            onClick={() => toggleKpi('draftInvoices')}
            active={expandedKpi === 'draftInvoices'}
            tone={countTone(draftInvoices.length, false, 'warn')}
            sub={countSub(draftInvoices.length, false, 'Drafts not sent yet')}
            hint="Draft invoices not yet sent. Click to send them here"
          />
          <KpiCard
            label="Overdue invoices"
            value={String(overdueCount)}
            loading={isLoading}
            onClick={() => toggleKpi('overdueInvoices')}
            active={expandedKpi === 'overdueInvoices'}
            tone={countTone(overdueCount, isLoading, 'danger')}
            sub={countSub(overdueCount, isLoading, `${fmt(overdueAmount)} past due date`)}
            hint="Invoices past their due date. Click to record a payment here"
          />
        </div>

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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draftInvoices.map((i) => (
                    <tr key={i.id} className={goTo ? 'row-link' : undefined} {...activateProps(goTo ? () => goTo('invoices', { filter: { invoiceView: 'draft', focus: 'inv-ledger' } }) : undefined)}>
                      <td>{clientName(i.client_id)}</td>
                      <td>{i.invoice_date ? fmtDate(i.invoice_date) : '—'}</td>
                      <td className="amt">{fmt(netPayable(i))}</td>
                      <td>
                        <SendInvoiceAction invoice={i} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewAll('invoices', 'Open drafts in Invoices', { invoiceView: 'draft', focus: 'inv-ledger' })}
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(overdueInvoices ?? []).map((i) => (
                    <Fragment key={i.id}>
                      <tr
                        className={goTo ? 'row-link' : undefined}
                        {...activateProps(goTo ? () => goTo('invoices', { filter: { clientId: i.client_id ?? undefined, invoiceView: 'overdue', focus: 'inv-ledger' } }) : undefined)}
                      >
                        <td>{clientName(i.client_id)}</td>
                        <td>{i.effective_due_date ? fmtDate(i.effective_due_date) : '—'}</td>
                        <td className="amt" style={{ color: 'var(--red)' }}>
                          {fmt(i.due_amount ?? 0)}
                        </td>
                        <td>
                          {i.id && (
                            <div className="dash-row-actions">
                              <button
                                type="button"
                                className="pay-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPayInvoiceId(payInvoiceId === i.id ? null : i.id)
                                }}
                              >
                                Record payment
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {i.id && payInvoiceId === i.id && (
                        <InvoicePaymentForm invoiceId={i.id} due={i.due_amount ?? 0} onClose={() => setPayInvoiceId(null)} />
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {viewAll('invoices', 'Open overdue in Invoices', { invoiceView: 'overdue', focus: 'inv-ledger' })}
            </div>
          ))}
        <div className="dash-subhead">Books</div>
        <div className="dash-grid">
          <KpiCard
            label="Books health"
            value={String(booksToFix + booksToReview)}
            loading={booksHealthLoading}
            tone={booksHealthLoading ? undefined : booksToFix > 0 ? 'danger' : booksToReview > 0 ? 'warn' : 'good'}
            sub={booksHealthLoading ? undefined : booksToFix + booksToReview === 0 ? 'All clear' : `${booksToFix} to fix · ${booksToReview} to review`}
            hint="A live audit of the ledger — click to see what needs a look"
            {...drill('reports', { report: 'books-health' })}
          />
        </div>
      </DashSection>

      <DashSection
        id="position"
        title="Position today"
        note={`not affected by the period filter${updatedAt ? ` · as of ${updatedAt}` : ''}`}
        open={sections.isOpen('position')}
        onToggle={() => sections.toggle('position')}
      >
        <div className="dash-grid">
          <KpiCard
            label="Cash & bank"
            value={fmt(data?.cash_and_bank_balance)}
            loading={isLoading}
            extra={cashSeries ? <Sparkline values={cashSeries} label="Cash and bank balance, last 30 days" /> : undefined}
            sub={cashSeries ? 'Last 30 days' : undefined}
            hint="Open the Cash & bank report"
            {...drill('reports', { report: 'cash-bank' })}
          />
          <KpiCard
            label="Outstanding from clients"
            value={fmt(data?.outstanding_from_clients)}
            loading={isLoading}
            sub={overdueAmount > 0 ? `${fmt(overdueAmount)} overdue` : 'Nothing overdue'}
            extra={
              outstandingAmount > 0 ? (
                <ProgressBar
                  value={overdueAmount}
                  total={outstandingAmount}
                  label={`${Math.round((overdueAmount / outstandingAmount) * 100)}% of it is overdue`}
                />
              ) : undefined
            }
            tone={!isLoading && overdueAmount > 0 ? 'warn' : undefined}
            hint="Collectible now, excluding retention. Click for the split by client"
            onClick={() => toggleKpi('outstanding')}
            active={expandedKpi === 'outstanding'}
          />
          <KpiCard
            label="Retention held by clients"
            value={fmt(totalRetentionHeld)}
            loading={isLoading}
            retention
            hint="Held back by clients until release. Click for the split by client"
            onClick={() => toggleKpi('retention')}
            active={expandedKpi === 'retention'}
          />
          <KpiCard
            label="GST held by clients"
            value={fmt(totalGstHeld)}
            loading={isLoading}
            sub={totalGstHeld > 0 ? 'Released after GSTR-3B proof' : undefined}
            hint="GST owed by clients who release it only after we file GSTR-3B and send proof. Click for the split by client"
            onClick={() => toggleKpi('gstHeld')}
            active={expandedKpi === 'gstHeld'}
          />
          <KpiCard
            label="Owed to vendors"
            value={fmt(data?.owed_to_vendors)}
            loading={isLoading}
            hint="Open the bills that are still unpaid"
            {...drill('purchases', { vendorView: 'unpaid', focus: 'bill-records' })}
          />
          <KpiCard
            label="Loan principal outstanding"
            value={fmt(data?.loan_principal_outstanding)}
            loading={isLoading}
            hint="Open Loans"
            {...drill('loans')}
          />
        </div>

        {expandedKpi === 'gstHeld' &&
          (() => {
            const rows = clientBalances.filter((r) => r.gstHeld > 0.01).sort((a, b) => b.gstHeld - a.gstHeld)
            if (rows.length === 0) {
              return (
                <div className="note" style={{ marginTop: 10 }}>
                  No GST is being held by any client.
                </div>
              )
            }
            return (
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th style={{ textAlign: 'right' }}>GST held</th>
                      <th style={{ textAlign: 'right' }}>Filed, proof not sent</th>
                      <th style={{ textAlign: 'right' }}>Proof sent, awaiting release</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className={goTo ? 'row-link' : undefined}
                        {...activateProps(goTo ? () => goTo('invoices', { filter: { clientId: r.id, invoiceView: 'gst', focus: 'inv-ledger' } }) : undefined)}
                      >
                        <td>{r.name}</td>
                        <td className="amt">{fmt(r.gstHeld)}</td>
                        <td className="amt">{r.gstProofToSend > 0.01 ? fmt(r.gstProofToSend) : '-'}</td>
                        <td className="amt">{r.gstAwaitingRelease > 0.01 ? fmt(r.gstAwaitingRelease) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {viewAll('invoices', 'Open held GST in Invoices', { invoiceView: 'gst', focus: 'inv-ledger' })}
              </div>
            )
          })()}

        {(expandedKpi === 'outstanding' || expandedKpi === 'retention') &&
          (() => {
            const key = expandedKpi === 'outstanding' ? 'due' : 'held'
            const rows = clientBalances.filter((r) => r[key] > 0.01).sort((a, b) => b[key] - a[key])
            if (rows.length === 0) {
              return (
                <div className="note" style={{ marginTop: 10 }}>
                  {key === 'due' ? 'No client owes anything collectible right now.' : 'No retention is being held.'}
                </div>
              )
            }
            return (
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th style={{ textAlign: 'right' }}>{key === 'due' ? 'Due' : 'Retention held'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={goTo ? 'row-link' : undefined} {...activateProps(goTo ? () => goTo('invoices', { filter: { clientId: r.id, invoiceView: key === 'due' ? 'due' : 'retention', focus: 'inv-ledger' } }) : undefined)}>
                        <td>{r.name}</td>
                        <td className={key === 'due' ? 'amt amt-due' : 'amt amt-retention'}>{fmt(r[key])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {viewAll('invoices', key === 'due' ? 'Open dues in Invoices' : 'Open retention in Invoices', {
                  invoiceView: key === 'due' ? 'due' : 'retention',
                  focus: 'inv-ledger',
                })}
              </div>
            )
          })()}

      </DashSection>

      <DashSection
        id="period"
        title="This period"
        note={PERIOD_LABEL[periodType]}
        open={sections.isOpen('period')}
        onToggle={() => sections.toggle('period')}
      >
        <div className="dash-grid">
          <KpiCard
            label="Revenue received"
            value={fmt(summary?.total_received)}
            loading={summaryLoading}
            extra={trend(summary?.total_received, prevSummary?.total_received, 'up')}
            hint="Open the receipts for this period"
            {...drill('invoices', { range: periodRange, focus: 'inv-payments' })}
          />
          <KpiCard
            label="Expenses"
            value={fmt(summary?.total_expenses)}
            loading={summaryLoading}
            extra={trend(summary?.total_expenses, prevSummary?.total_expenses, 'down')}
            hint="Open Expenses for this period"
            {...drill('expenses', { range: periodRange })}
          />
          <KpiCard
            label="Vendor purchases"
            value={fmt(summary?.vendor_purchases)}
            loading={summaryLoading}
            extra={trend(summary?.vendor_purchases, prevSummary?.vendor_purchases, 'down')}
            hint="Open the bills for this period"
            {...drill('purchases', { range: periodRange, focus: 'bill-records' })}
          />
          <KpiCard
            label="Net GST payable"
            value={fmt((summary?.output_gst ?? 0) - (summary?.input_gst ?? 0))}
            loading={summaryLoading}
            extra={trend(
              (summary?.output_gst ?? 0) - (summary?.input_gst ?? 0),
              prevSummary ? (prevSummary.output_gst ?? 0) - (prevSummary.input_gst ?? 0) : undefined,
              'neutral'
            )}
            hint="Click to see how it is calculated"
            onClick={() => toggleKpi('gst')}
            active={expandedKpi === 'gst'}
          />
        </div>

        {expandedKpi === 'gst' &&
          (() => {
            const output = summary?.output_gst ?? 0
            const input = summary?.input_gst ?? 0
            const net = output - input
            return (
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Net GST calculation — {PERIOD_LABEL[periodType]}</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Output GST — charged on invoices</td>
                      <td className="amt">{fmt(output)}</td>
                    </tr>
                    <tr>
                      <td>Less: Input GST — paid on vendor bills</td>
                      <td className="amt">− {fmt(input)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Net GST payable</strong>
                      </td>
                      <td className={net > 0 ? 'amt amt-due' : 'amt amt-extra'}>
                        <strong>{fmt(net)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
                {net < 0 && <div className="note">Input GST is more than output GST this period — the difference is a credit.</div>}
                {viewAll('reports', 'Open the GST summary', {
                  report: 'gst-summary',
                  period: { type: periodType, from: range?.from ?? null, to: range?.to ?? null },
                })}
              </div>
            )
          })()}
      </DashSection>

      <DashSection id="projects" title="Projects" open={sections.isOpen('projects')} onToggle={() => sections.toggle('projects')}>
        <div className="dash-grid">
          <KpiCard
            label="Active projects"
            value={String(data?.active_projects ?? 0)}
            loading={isLoading}
            hint="Open Projects"
            {...drill('projects')}
          />
          <KpiCard
            label="Projects over budget"
            value={String(projectsOverBudgetCount)}
            loading={projectsLoading}
            tone={countTone(projectsOverBudgetCount, projectsLoading, 'danger')}
            sub={countSub(projectsOverBudgetCount, projectsLoading, 'Spend is above budget')}
            hint="Open Projects"
            {...drill('projects')}
          />
          <KpiCard
            label="Completed, payment pending"
            value={String(completedPaymentPendingCount)}
            loading={projectsLoading}
            tone={countTone(completedPaymentPendingCount, projectsLoading, 'warn')}
            sub={countSub(completedPaymentPendingCount, projectsLoading, 'Finished but not fully paid')}
            hint="Open Projects"
            {...drill('projects')}
          />
        </div>
      </DashSection>

      {error && (
        <div className="note" style={{ color: 'var(--red)' }}>
          Could not load dashboard: {(error as Error).message}
        </div>
      )}

      <DashSection
        id="insights"
        title="Trends & analysis"
        open={sections.isOpen('insights')}
        onToggle={() => sections.toggle('insights')}
      >
        <DashboardInsights
          invoices={invoices ?? []}
          payments={invoicePayments ?? []}
          clients={clients ?? []}
          expenses={allExpenses ?? []}
          range={range}
          periodLabel={PERIOD_LABEL[periodType]}
        />
      </DashSection>

      <DashSection
        id="reports"
        title="Reports & summaries"
        note={PERIOD_LABEL[periodType]}
        open={sections.isOpen('reports')}
        onToggle={() => sections.toggle('reports')}
      >
        <FinancialSummaryReport range={range} />
        <GstSummaryReport range={range} />
        <ReimbursementDue />
        <ExpenseSummary range={range} />
      </DashSection>
    </div>
  )
}
