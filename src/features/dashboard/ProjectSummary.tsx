import { Fragment, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { fmt } from '../../lib/calc/format'
import { inRange, projectSpend, sumOf, totalsBy } from '../../lib/calc/periodActivity'
import { projectExpenseTotal, projectInvoicedRevenueExGst, projectReceivedRevenue, projectVendorBillTotal, projectWageByStaff } from '../../lib/calc/projects'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { clientLabel } from '../../lib/labels'
import type { GoTo } from '../../lib/navContext'
import { useHolidays } from '../../lib/queries/hr'
import { useExpenses } from '../../lib/queries/expenses'
import { useInvoicePayments, useInvoices } from '../../lib/queries/invoices'
import { useClients, useExpenseSubHeads, useProjects, useStaff } from '../../lib/queries/masters'
import { useVendorBills } from '../../lib/queries/purchases'
import { useAllStaffAttendance, useAllStaffProjectAssignments } from '../../lib/queries/teamTracking'

const todayStr = () => new Date().toISOString().slice(0, 10)
const EARLIEST = '2000-01-01'

/** Every project at a glance: what it has cost so far and against its budget, what it cost in the chosen period (highlighted),
 * and what has been invoiced and received. Open a row with + for the period's spending by type of cost. */
export function ProjectSummary({ range, periodLabel, goTo }: { range: DateRange | null; periodLabel: string; goTo: GoTo | null }) {
  const { data: projects, isLoading } = useProjects()
  const { data: clients } = useClients()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: expenses } = useExpenses(null)
  const { data: bills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null, { sentOnly: true })
  const { data: payments } = useInvoicePayments()
  const { data: staff } = useStaff()
  const { data: attendance } = useAllStaffAttendance()
  const { data: assignments } = useAllStaffProjectAssignments()
  const { data: holidays } = useHolidays()
  const [open, setOpen] = useState<string | null>(null)
  const [showFinished, setShowFinished] = useState(true)

  const rows = useMemo(() => {
    const today = todayStr()
    const holidayDates = new Set((holidays ?? []).map((h) => h.date))
    const wages = (projectId: string, from: string, to: string) =>
      projectWageByStaff(projectId, today, staff ?? [], attendance ?? [], assignments ?? [], holidayDates, from, to).reduce((s, r) => s + r.amount, 0)
    const periodFrom = range?.from ?? EARLIEST
    const periodTo = range?.to && range.to < today ? range.to : today

    return (projects ?? []).map((p) => {
      const wagesAll = wages(p.id, EARLIEST, today)
      const wagesPeriod = range ? wages(p.id, periodFrom, periodTo) : wagesAll
      const spendPeriod = projectSpend(p.id, expenses ?? [], bills ?? [], range)
      const spent = projectExpenseTotal(p.id, expenses ?? []) + projectVendorBillTotal(p.id, bills ?? []) + wagesAll
      const period = spendPeriod.total + wagesPeriod
      const invoiced = projectInvoicedRevenueExGst(p.id, invoices ?? [])
      const received = projectReceivedRevenue(p.id, invoices ?? [], payments ?? [])
      const budget = p.budget ?? null
      return {
        project: p,
        spent,
        period,
        bills: spendPeriod.bills,
        expenses: spendPeriod.expenses,
        wages: wagesPeriod,
        invoiced,
        received,
        budget,
        usedPct: budget && budget > 0 ? Math.round((spent / budget) * 100) : null,
      }
    })
  }, [projects, expenses, bills, invoices, payments, staff, attendance, assignments, holidays, range])

  const shown = rows
    .filter((r) => showFinished || r.project.status === 'active')
    .sort((a, b) => b.period - a.period || a.project.name.localeCompare(b.project.name))

  // The period's spending on one project, by type of cost.
  function breakdown(projectId: string) {
    const subName = (id: string | null) => (id ? subHeads?.find((s) => s.id === id)?.name ?? 'Other' : 'No type of cost')
    const lines = [
      ...(expenses ?? []).filter((e) => e.project_id === projectId && inRange(e.date, range)).map((e) => ({ name: subName(e.sub_head_id), amount: Number(e.amount) })),
      ...(bills ?? [])
        .filter((b) => b.project_id === projectId && !!b.date && inRange(b.date as string, range))
        .map((b) => ({ name: `${subName(b.sub_head_id)} (vendor bills)`, amount: Number(b.amount) + Number(b.other_cost ?? 0) + (Number(b.amount) * Number(b.gst_pct ?? 0)) / 100 })),
    ]
    const wageRow = rows.find((r) => r.project.id === projectId)?.wages ?? 0
    const grouped = totalsBy(lines, (l) => l.name, (l) => l.amount)
    return wageRow > 0 ? [...grouped, { key: 'Salaries (site crew)', count: 0, amount: wageRow }].sort((a, b) => b.amount - a.amount) : grouped
  }

  const totals = {
    spent: sumOf(shown, (r) => r.spent),
    period: sumOf(shown, (r) => r.period),
    invoiced: sumOf(shown, (r) => r.invoiced),
    received: sumOf(shown, (r) => r.received),
  }
  const withSpend = shown.filter((r) => r.period > 0.004).length

  if (isLoading) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div className="dash-subhead">Project summary</div>
      <div className="note" style={{ margin: '0 0 8px' }}>
        Projects that had spending {periodLabel} are at the top, and the amount is highlighted. <strong>{withSpend}</strong> of {shown.length} project{shown.length === 1 ? '' : 's'}{' '}
        had spending {periodLabel}, <strong>{fmt(totals.period)}</strong> in all. &ldquo;Spent so far&rdquo; counts expenses, vendor bills and site wages, as on the Projects page.
        <label className="check-inline" style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} /> Include finished projects
        </label>
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th>Project</th>
              <th style={{ textAlign: 'right' }}>Budget</th>
              <th style={{ textAlign: 'right' }}>Spent so far</th>
              <th style={{ textAlign: 'right' }}>Budget used</th>
              <th style={{ textAlign: 'right', background: 'var(--amber-soft)' }}>Spent {periodLabel}</th>
              <th style={{ textAlign: 'right' }}>Invoiced</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>To collect</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No projects yet.
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const hot = r.period > 0.004
              const isOpen = open === r.project.id
              const over = r.usedPct !== null && r.usedPct > 100
              return (
                <Fragment key={r.project.id}>
                  <tr style={hot ? { boxShadow: 'inset 4px 0 0 var(--amber)' } : undefined}>
                    <td>
                      {hot && (
                        <button
                          type="button"
                          className="row-expand-btn"
                          aria-label={isOpen ? 'Hide the split' : 'Show the split by type of cost'}
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : r.project.id)}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      )}
                    </td>
                    <td>
                      {r.project.name}
                      <div className="retention-note">
                        {clientLabel(clients?.find((c) => c.id === r.project.client_id))}
                        {r.project.status !== 'active' ? ` · ${r.project.status}` : ''}
                      </div>
                    </td>
                    <td className="amt">{r.budget !== null ? fmt(r.budget) : '—'}</td>
                    <td className="amt">{fmt(r.spent)}</td>
                    <td className="amt" style={{ color: over ? 'var(--red)' : undefined, fontWeight: over ? 700 : undefined }}>
                      {r.usedPct !== null ? `${r.usedPct}%` : '—'}
                    </td>
                    <td className="amt" style={{ background: hot ? 'var(--amber-soft)' : undefined, fontWeight: hot ? 700 : undefined }}>
                      {hot ? fmt(r.period) : '—'}
                      {hot && (
                        <div className="retention-note" style={{ fontWeight: 400 }}>
                          {[r.bills > 0 ? `bills ${fmt(r.bills)}` : '', r.expenses > 0 ? `expenses ${fmt(r.expenses)}` : '', r.wages > 0 ? `wages ${fmt(r.wages)}` : ''].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="amt">{fmt(r.invoiced)}</td>
                    <td className="amt">{fmt(r.received)}</td>
                    <td className="amt">{fmt(r.invoiced - r.received)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="pay-form-row">
                      <td colSpan={9}>
                        <div className="note" style={{ margin: '0 0 6px', fontWeight: 600 }}>
                          What was spent on {r.project.name} {periodLabel}
                        </div>
                        <table className="data">
                          <thead>
                            <tr>
                              <th>Type of cost</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown(r.project.id).map((g) => (
                              <tr key={g.key}>
                                <td>{g.key}</td>
                                <td className="amt">{fmt(g.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td></td>
                <td style={{ fontWeight: 600 }}>Total</td>
                <td></td>
                <td className="amt" style={{ fontWeight: 600 }}>
                  {fmt(totals.spent)}
                </td>
                <td></td>
                <td className="amt" style={{ fontWeight: 700, background: 'var(--amber-soft)' }}>
                  {fmt(totals.period)}
                </td>
                <td className="amt" style={{ fontWeight: 600 }}>
                  {fmt(totals.invoiced)}
                </td>
                <td className="amt" style={{ fontWeight: 600 }}>
                  {fmt(totals.received)}
                </td>
                <td className="amt" style={{ fontWeight: 600 }}>
                  {fmt(totals.invoiced - totals.received)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {goTo && (
        <div className="dash-viewall">
          <Button type="button" variant="link" onClick={() => goTo('projects')}>
            Open Projects {'→'}
          </Button>
        </div>
      )}
    </div>
  )
}
