import { useState } from 'react'
import { Button } from '../../components/ui'
import { fmt, fmtDate } from '../../lib/calc/format'
import { dueAmount, effectiveDueDate } from '../../lib/calc/invoices'
import { clientFullName } from '../../lib/labels'
import { useVendorBillPayments } from '../../lib/queries/purchases'
import { useGoTo } from '../../lib/navContext'
import { EXPENSE_COST_CENTERS, type ExpenseCostCenter } from '../../lib/nav'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { Database } from '../../types/database'
import { HBarChart, MonthBars, type BarItem, type MonthPair } from './dashViz'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']

const AGE_BUCKETS = [
  { key: 'current', label: 'Not yet due', tone: 'default' as const },
  { key: 'd30', label: '1–30 days late', tone: 'warn' as const },
  { key: 'd60', label: '31–60 days late', tone: 'warn' as const },
  { key: 'd90', label: '61–90 days late', tone: 'danger' as const },
  { key: 'd90p', label: 'Over 90 days', tone: 'danger' as const },
  { key: 'nodue', label: 'No due date', tone: 'default' as const },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysLate(dueISO: string): number {
  const [dy, dm, dd] = dueISO.split('-').map(Number)
  const [ty, tm, td] = todayISO().split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(dy, dm - 1, dd)) / 86400000)
}

function ageBucketOf(dueISO: string | null): string {
  if (!dueISO) return 'nodue'
  const late = daysLate(dueISO)
  if (late <= 0) return 'current'
  if (late <= 30) return 'd30'
  if (late <= 60) return 'd60'
  if (late <= 90) return 'd90'
  return 'd90p'
}

/** The last six calendar months, oldest first, keyed YYYY-MM. */
function lastSixMonths(): { key: string; label: string }[] {
  const now = new Date()
  const out: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    })
  }
  return out
}

/** Three charts that answer "where is the money": who owes us and for how
 * long, what came in against what went out, and where spending is going.
 * Picking a bar narrows the table under that chart to it. */
export function DashboardInsights({
  invoices,
  payments,
  clients,
  expenses,
  range,
  periodLabel,
}: {
  invoices: Invoice[]
  payments: InvoicePayment[]
  clients: Client[]
  expenses: Expense[]
  range: DateRange | null
  periodLabel: string
}) {
  const goTo = useGoTo()
  const { data: vendorPayments } = useVendorBillPayments()
  const [ageSel, setAgeSel] = useState<string | null>(null)
  const [monthSel, setMonthSel] = useState<string | null>(null)
  const [centreSel, setCentreSel] = useState<string | null>(null)

  const clientName = (id: string) => clientFullName(clients.find((c) => c.id === id))

  // ── Client dues by age ────────────────────────────────────────────────
  const dueRows = invoices
    .filter((inv) => inv.status === 'sent')
    .map((inv) => {
      const due = dueAmount(inv, payments.filter((p) => p.invoice_id === inv.id))
      const dueDate = effectiveDueDate(inv)
      return { inv, due, dueDate, bucket: ageBucketOf(dueDate) }
    })
    .filter((r) => r.due > 0.01)
  const ageItems: BarItem[] = AGE_BUCKETS.map((b) => {
    const rows = dueRows.filter((r) => r.bucket === b.key)
    return {
      key: b.key,
      label: b.label,
      value: rows.reduce((s, r) => s + r.due, 0),
      tone: b.tone === 'default' ? undefined : b.tone,
      detail: `${rows.length} invoice${rows.length === 1 ? '' : 's'}`,
    }
  }).filter((i) => i.value > 0.01)
  const ageDrill = ageSel ? dueRows.filter((r) => r.bucket === ageSel).sort((a, b) => b.due - a.due) : []

  // ── Money in vs out, last six months ──────────────────────────────────
  const months = lastSixMonths()
  const spentBy = (key: string) => {
    const centres = new Map<string, number>()
    for (const e of expenses) {
      if (e.date.slice(0, 7) !== key) continue
      const c = e.cost_center ?? 'Other'
      centres.set(c, (centres.get(c) ?? 0) + Number(e.amount || 0))
    }
    const vendor = (vendorPayments ?? []).filter((p) => p.date.slice(0, 7) === key).reduce((s, p) => s + Number(p.amount || 0), 0)
    return { centres, vendor, total: [...centres.values()].reduce((s, v) => s + v, 0) + vendor }
  }
  const monthPairs: MonthPair[] = months.map((m) => ({
    key: m.key,
    label: m.label,
    inflow: payments.filter((p) => p.date.slice(0, 7) === m.key).reduce((s, p) => s + Number(p.amount || 0), 0),
    outflow: spentBy(m.key).total,
  }))
  const monthPick = monthSel ? monthPairs.find((m) => m.key === monthSel) : undefined
  const monthSpend = monthSel ? spentBy(monthSel) : null

  // ── Expenses by cost centre, for the selected period ──────────────────
  const inRange = expenses.filter((e) => (!range?.from || e.date >= range.from) && (!range?.to || e.date <= range.to))
  const centreTotals = new Map<string, number>()
  for (const e of inRange) {
    const c = e.cost_center ?? 'Other'
    centreTotals.set(c, (centreTotals.get(c) ?? 0) + Number(e.amount || 0))
  }
  const centreItems: BarItem[] = [...centreTotals.entries()]
    .map(([key, value]) => ({ key, label: key, value }))
    .filter((i) => i.value > 0.01)
    .sort((a, b) => b.value - a.value)
  const centreDrill = centreSel
    ? inRange
        .filter((e) => (e.cost_center ?? 'Other') === centreSel)
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 8)
    : []
  const centreTab = (EXPENSE_COST_CENTERS as readonly string[]).includes(centreSel ?? '') ? (centreSel as ExpenseCostCenter) : undefined

  return (
    <div className="dash-insights">
      <div className="dash-panel">
        <h3 className="dash-panel-title">Client dues by age</h3>
        <p className="dash-panel-sub">Collectible now, grouped by how late. Tap a bar for the invoices.</p>
        <HBarChart items={ageItems} selectedKey={ageSel} onSelect={setAgeSel} empty="No client has anything due." />
        {ageSel && ageDrill.length > 0 && (
          <div className="dash-drill table-scroll">
            <div className="dash-drill-title">{AGE_BUCKETS.find((b) => b.key === ageSel)?.label}</div>
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Invoice</th>
                  <th>Due date</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {ageDrill.map((r) => (
                  <tr key={r.inv.id} className={goTo ? 'row-link' : undefined} onClick={goTo ? () => goTo('invoices') : undefined}>
                    <td>{clientName(r.inv.client_id)}</td>
                    <td>{r.inv.invoice_number ?? r.inv.display_id ?? '—'}</td>
                    <td>{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                    <td className="amt amt-due">{fmt(r.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {goTo && (
              <div className="dash-viewall">
                <Button type="button" variant="link" onClick={() => goTo('invoices')}>
                  Open Invoices {'→'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dash-panel">
        <h3 className="dash-panel-title">Money in vs out</h3>
        <p className="dash-panel-sub">Last six months — client receipts against expenses and vendor payments. Tap a month.</p>
        <MonthBars months={monthPairs} selectedKey={monthSel} onSelect={setMonthSel} />
        {monthPick && monthSpend && (
          <div className="dash-drill table-scroll">
            <div className="dash-drill-title">{months.find((m) => m.key === monthSel)?.label}</div>
            <table className="data">
              <tbody>
                <tr>
                  <td>Received from clients</td>
                  <td className="amt amt-extra">{fmt(monthPick.inflow)}</td>
                </tr>
                {[...monthSpend.centres.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([centre, value]) => (
                    <tr key={centre}>
                      <td>Expenses — {centre}</td>
                      <td className="amt">{fmt(value)}</td>
                    </tr>
                  ))}
                <tr>
                  <td>Vendor payments</td>
                  <td className="amt">{fmt(monthSpend.vendor)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Net</strong>
                  </td>
                  <td className={`amt ${monthPick.inflow - monthPick.outflow >= 0 ? 'amt-extra' : 'amt-due'}`}>
                    <strong>{fmt(monthPick.inflow - monthPick.outflow)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dash-panel">
        <h3 className="dash-panel-title">Expenses by cost centre</h3>
        <p className="dash-panel-sub">Approved spending, {periodLabel}. Tap a bar for the biggest entries.</p>
        <HBarChart items={centreItems} selectedKey={centreSel} onSelect={setCentreSel} empty="No expenses in this period." />
        {centreSel && centreDrill.length > 0 && (
          <div className="dash-drill table-scroll">
            <div className="dash-drill-title">Largest entries — {centreSel}</div>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {centreDrill.map((e) => (
                  <tr
                    key={e.id}
                    className={goTo ? 'row-link' : undefined}
                    onClick={goTo ? () => goTo('expenses', centreTab ? { costCenter: centreTab } : undefined) : undefined}
                  >
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.description || '—'}</td>
                    <td className="amt">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {goTo && (
              <div className="dash-viewall">
                <Button type="button" variant="link" onClick={() => goTo('expenses', centreTab ? { costCenter: centreTab } : undefined)}>
                  Open Expenses {'→'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
