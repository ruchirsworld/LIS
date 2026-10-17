import type { ReactNode } from 'react'
import { Button, KpiCard } from '../../components/ui'
import { fmt, fmtDate } from '../../lib/calc/format'
import { inRange, sumOf, totalsBy, vendorPaidTotals } from '../../lib/calc/periodActivity'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { GoTo } from '../../lib/navContext'
import { useExpenses } from '../../lib/queries/expenses'
import { useWagePayments } from '../../lib/queries/hr'
import { useInvoicePayments, useInvoices } from '../../lib/queries/invoices'
import { useLoanPayments, useLoans } from '../../lib/queries/loans'
import { useCapitalTx } from '../../lib/queries/capital'
import { useClients, useExpenseSubHeads, useProjects, useStaff, useVendors } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useTrips } from '../../lib/queries/trips'
import { useVendorAdvances, useVendorBillPayments, useVendorBills } from '../../lib/queries/purchases'
import { clientFullName } from '../../lib/labels'
import { SpendBySource } from '../trips/SpendBySource'

/** The cards of "This period" that can be opened with the + to see what is behind them. */
export type PeriodKpiId = 'revenue' | 'tripExp' | 'adminExp' | 'projectExp' | 'salary' | 'vendorPaid' | 'loans' | 'capital'

/** A small table for a card's detail, with a total at the foot. Columns in `right` are amounts. */
function Peek({ head, rows, foot, right = [] }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; right?: number[] }) {
  if (rows.length === 0) return <div className="note">Nothing in this period.</div>
  const align = (i: number) => (right.includes(i) ? ({ textAlign: 'right' } as const) : undefined)
  return (
    <div className="table-scroll" style={{ marginTop: 8 }}>
      <table className="data">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} style={align(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={right.includes(j) ? 'amt' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr>
              {foot.map((c, j) => (
                <td key={j} className={right.includes(j) ? 'amt' : undefined} style={{ fontWeight: 600 }}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function OpenLink({ goTo, label, onClick }: { goTo: GoTo | null; label: string; onClick: () => void }) {
  if (!goTo) return null
  return (
    <div className="dash-viewall">
      <Button type="button" variant="link" onClick={onClick}>
        {label} {'→'}
      </Button>
    </div>
  )
}

/** Receipts from clients in the period: who paid, against which invoice, how much. */
export function RevenueDetail({ range, goTo }: { range: DateRange | null; goTo: GoTo | null }) {
  const { data: payments } = useInvoicePayments()
  const { data: invoices } = useInvoices(null)
  const { data: clients } = useClients()
  const rows = (payments ?? []).filter((p) => inRange(p.date, range)).sort((a, b) => b.date.localeCompare(a.date))
  const invoiceOf = (id: string) => (invoices ?? []).find((i) => i.id === id)
  const clientOf = (invoiceId: string) => clientFullName((clients ?? []).find((c) => c.id === invoiceOf(invoiceId)?.client_id))
  return (
    <div style={{ marginTop: 10 }}>
      <Peek
        head={['Date', 'Client', 'Invoice', 'Amount']}
        right={[3]}
        rows={rows.map((p) => [
          fmtDate(p.date),
          clientOf(p.invoice_id),
          <>
            {invoiceOf(p.invoice_id)?.invoice_number || invoiceOf(p.invoice_id)?.display_id || '—'}
            {p.is_retention_release ? <div className="retention-note">Retention released</div> : null}
          </>,
          fmt(p.amount),
        ])}
        foot={['Total', '', '', fmt(sumOf(rows, (p) => p.amount))]}
      />
      <OpenLink goTo={goTo} label="Open the receipts" onClick={() => goTo?.('receipts', { filter: { range: range?.from && range?.to ? { from: range.from, to: range.to } : undefined, focus: 'inv-payments' } })} />
    </div>
  )
}

/** Where money went and came from in the period: trips, office and project costs, salary, vendors, loans and capital. */
export function PeriodActivity({
  range,
  expanded,
  onToggle,
  goTo,
}: {
  range: DateRange | null
  expanded: string | null
  onToggle: (id: PeriodKpiId) => void
  goTo: GoTo | null
}) {
  // The same full lists the rest of the dashboard already loads, cut to the period here, so no second request is made.
  const { data: allExpenses, isLoading: expLoading } = useExpenses(null)
  const { data: trips } = useTrips()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: wages, isLoading: wagesLoading } = useWagePayments()
  const { data: staff } = useStaff()
  const { data: billPayments, isLoading: payLoading } = useVendorBillPayments()
  const { data: advances } = useVendorAdvances()
  const { data: bills } = useVendorBills(null)
  const { data: vendors } = useVendors()
  const { data: allLoans } = useLoans(null)
  const { data: loanPayments } = useLoanPayments()
  const { data: allCapital } = useCapitalTx(null)

  const periodRange = range?.from && range?.to ? { from: range.from, to: range.to } : undefined
  const expenses = (allExpenses ?? []).filter((e) => inRange(e.date, range))
  const loansInPeriod = (allLoans ?? []).filter((l) => inRange(l.date_taken ?? '', range))
  const capital = (allCapital ?? []).filter((c) => inRange(c.date ?? '', range))

  // Spending, by where it was booked.
  const tripExp = expenses.filter((e) => e.cost_center === 'Trips')
  const adminExp = expenses.filter((e) => e.cost_center === 'Admin')
  const projectExp = expenses.filter((e) => e.cost_center === 'Project')
  const total = (rows: { amount: number }[]) => sumOf(rows, (r) => r.amount)

  const tripName = (id: string | null) => (id ? trips?.find((t) => t.id === id)?.name ?? 'Trip' : 'Not on a trip')
  const travelerOf = (name: string) => {
    const t = trips?.find((x) => x.name === name)
    return t ? profiles?.find((p) => p.id === t.traveler_id)?.name ?? '—' : '—'
  }
  const byTrip = totalsBy(tripExp, (e) => tripName(e.trip_id), (e) => e.amount)
  const bySubHead = totalsBy(adminExp, (e) => (e.sub_head_id ? subHeads?.find((s) => s.id === e.sub_head_id)?.name ?? 'Other' : 'No type of cost'), (e) => e.amount)
  const byProject = totalsBy(projectExp, (e) => (e.project_id ? projects?.find((p) => p.id === e.project_id)?.name ?? 'Project' : 'No project'), (e) => e.amount)

  // Salary paid.
  const wagesIn = (wages ?? []).filter((w) => inRange(w.date, range))
  const byPerson = totalsBy(wagesIn, (w) => staff?.find((s) => s.id === w.staff_id)?.name ?? 'Staff', (w) => w.amount)

  // Paid to vendors: payments on bills plus advances (not the automatic set-off of an advance against a bill).
  const vendorNameOfBill = (billId: string) => vendors?.find((v) => v.id === bills?.find((b) => b.id === billId)?.vendor_id)?.name ?? 'Vendor'
  const vendorTotals = vendorPaidTotals(billPayments ?? [], advances ?? [], range)
  const paymentsIn = (billPayments ?? []).filter((p) => p.payment_mode !== 'Advance' && inRange(p.date, range))
  const advancesIn = (advances ?? []).filter((a) => inRange(a.date, range))
  const vendorRows = (() => {
    const map = new Map<string, { bills: number; advances: number }>()
    for (const p of paymentsIn) {
      const k = vendorNameOfBill(p.bill_id)
      map.set(k, { bills: (map.get(k)?.bills ?? 0) + Number(p.amount), advances: map.get(k)?.advances ?? 0 })
    }
    for (const a of advancesIn) {
      const k = vendors?.find((v) => v.id === a.vendor_id)?.name ?? 'Vendor'
      map.set(k, { bills: map.get(k)?.bills ?? 0, advances: (map.get(k)?.advances ?? 0) + Number(a.amount) })
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v, total: v.bills + v.advances })).sort((a, b) => b.total - a.total)
  })()

  // Loans taken and repaid.
  const loansReceived = sumOf(loansInPeriod, (l) => l.principal)
  const repaymentsIn = (loanPayments ?? []).filter((p) => inRange(p.date, range))
  const principalPaid = sumOf(repaymentsIn, (p) => p.principal_paid)
  const interestPaid = sumOf(repaymentsIn, (p) => p.interest_paid)
  const lenderOf = (loanId: string) => allLoans?.find((l) => l.id === loanId)?.lender ?? 'Loan'

  // Capital in and out.
  const injected = sumOf(capital.filter((c) => c.type === 'injection'), (c) => c.amount)
  const withdrawn = sumOf(capital.filter((c) => c.type === 'withdrawal'), (c) => c.amount)
  const partnerRows = (() => {
    const map = new Map<string, { in: number; out: number }>()
    for (const c of capital) {
      const k = profiles?.find((p) => p.id === c.partner_id)?.name ?? 'Partner'
      const cur = map.get(k) ?? { in: 0, out: 0 }
      if (c.type === 'injection') cur.in += Number(c.amount)
      else cur.out += Number(c.amount)
      map.set(k, cur)
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v }))
  })()

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const open = (id: PeriodKpiId) => expanded === id
  const card = (id: PeriodKpiId, label: string, value: string, sub: string, loading: boolean, hint: string) => (
    <KpiCard label={label} value={value} sub={sub} loading={loading} hint={hint} onClick={() => onToggle(id)} active={open(id)} />
  )

  return (
    <>
      <div className="dash-subhead">Money spent, paid and received</div>
      <div className="dash-grid">
        {card('tripExp', 'Trip expenses', fmt(total(tripExp)), count(byTrip.length, 'trip', 'trips') + ' · ' + count(tripExp.length, 'entry', 'entries'), expLoading, 'Click for the trip summary for this period')}
        {card('adminExp', 'Admin expenses', fmt(total(adminExp)), count(adminExp.length, 'entry', 'entries'), expLoading, 'Office costs entered in this period. Click for the split')}
        {card('projectExp', 'Project expenses', fmt(total(projectExp)), count(byProject.length, 'project', 'projects') + ' · ' + count(projectExp.length, 'entry', 'entries'), expLoading, 'Site costs entered in this period. Click for the split by project')}
        {card('salary', 'Salary paid', fmt(sumOf(wagesIn, (w) => w.amount)), count(byPerson.length, 'person', 'people') + ' · ' + count(wagesIn.length, 'payment', 'payments'), wagesLoading, 'Wages paid in this period. Click for the split by person')}
        {card(
          'vendorPaid',
          'Paid to vendors',
          fmt(vendorTotals.total),
          vendorTotals.advances > 0 ? `${fmt(vendorTotals.bills)} on bills + ${fmt(vendorTotals.advances)} in advances` : count(paymentsIn.length, 'payment', 'payments'),
          payLoading,
          'Payments to vendors in this period. Click for the split by vendor'
        )}
        {card(
          'loans',
          'Loans received',
          fmt(loansReceived),
          `Repaid ${fmt(principalPaid + interestPaid)}${interestPaid > 0 ? ` (interest ${fmt(interestPaid)})` : ''}`,
          false,
          'Loans taken, and what was repaid, in this period. Click for the details'
        )}
        {card('capital', 'Capital received', fmt(injected), `Withdrawn ${fmt(withdrawn)}`, false, 'Money partners put in and took out in this period. Click for the details')}
      </div>

      {open('tripExp') && (
        <div style={{ marginTop: 10 }}>
          <SpendBySource expenses={tripExp} label="Trip spend, paid via" />
          <Peek
            head={['Trip', 'Traveler', 'Entries', 'Spent']}
            right={[2, 3]}
            rows={byTrip.map((t) => [t.key, travelerOf(t.key), String(t.count), fmt(t.amount)])}
            foot={['Total', '', String(tripExp.length), fmt(total(tripExp))]}
          />
          <OpenLink goTo={goTo} label="Open Trips" onClick={() => goTo?.('expenses', { costCenter: 'Trips', filter: { range: periodRange } })} />
        </div>
      )}
      {open('adminExp') && (
        <div style={{ marginTop: 10 }}>
          <SpendBySource expenses={adminExp} label="Admin spend, paid via" />
          <Peek
            head={['Type of cost', 'Entries', 'Spent']}
            right={[1, 2]}
            rows={bySubHead.map((g) => [g.key, String(g.count), fmt(g.amount)])}
            foot={['Total', String(adminExp.length), fmt(total(adminExp))]}
          />
          <OpenLink goTo={goTo} label="Open Admin expenses" onClick={() => goTo?.('expenses', { costCenter: 'Admin', filter: { range: periodRange } })} />
        </div>
      )}
      {open('projectExp') && (
        <div style={{ marginTop: 10 }}>
          <SpendBySource expenses={projectExp} label="Project spend, paid via" />
          <Peek
            head={['Project', 'Entries', 'Spent']}
            right={[1, 2]}
            rows={byProject.map((g) => [g.key, String(g.count), fmt(g.amount)])}
            foot={['Total', String(projectExp.length), fmt(total(projectExp))]}
          />
          <OpenLink goTo={goTo} label="Open Project expenses" onClick={() => goTo?.('expenses', { costCenter: 'Project', filter: { range: periodRange } })} />
        </div>
      )}
      {open('salary') && (
        <div style={{ marginTop: 10 }}>
          <Peek
            head={['Person', 'Payments', 'Paid']}
            right={[1, 2]}
            rows={byPerson.map((g) => [g.key, String(g.count), fmt(g.amount)])}
            foot={['Total', String(wagesIn.length), fmt(sumOf(wagesIn, (w) => w.amount))]}
          />
          <OpenLink goTo={goTo} label="Open Salary" onClick={() => goTo?.('hr')} />
        </div>
      )}
      {open('vendorPaid') && (
        <div style={{ marginTop: 10 }}>
          <Peek
            head={['Vendor', 'Paid on bills', 'Advances', 'Total']}
            right={[1, 2, 3]}
            rows={vendorRows.map((v) => [v.name, fmt(v.bills), fmt(v.advances), fmt(v.total)])}
            foot={['Total', fmt(vendorTotals.bills), fmt(vendorTotals.advances), fmt(vendorTotals.total)]}
          />
          <div className="note">An advance that was later set against a bill is counted once, when the advance was paid.</div>
          <OpenLink goTo={goTo} label="Open Procurements" onClick={() => goTo?.('purchases', { filter: { range: periodRange } })} />
        </div>
      )}
      {open('loans') && (
        <div style={{ marginTop: 10 }}>
          <div className="note" style={{ margin: 0, fontWeight: 600 }}>
            Loans received
          </div>
          <Peek
            head={['Date', 'Lender', 'Amount']}
            right={[2]}
            rows={loansInPeriod.map((l) => [fmtDate(l.date_taken), l.lender, fmt(l.principal)])}
            foot={['Total', '', fmt(loansReceived)]}
          />
          <div className="note" style={{ margin: '12px 0 0', fontWeight: 600 }}>
            Repayments
          </div>
          <Peek
            head={['Date', 'Lender', 'Principal', 'Interest', 'Total']}
            right={[2, 3, 4]}
            rows={repaymentsIn.map((p) => [fmtDate(p.date), lenderOf(p.loan_id), fmt(p.principal_paid), fmt(p.interest_paid), fmt(Number(p.principal_paid) + Number(p.interest_paid))])}
            foot={['Total', '', fmt(principalPaid), fmt(interestPaid), fmt(principalPaid + interestPaid)]}
          />
          <OpenLink goTo={goTo} label="Open Loans" onClick={() => goTo?.('loans')} />
        </div>
      )}
      {open('capital') && (
        <div style={{ marginTop: 10 }}>
          <Peek
            head={['Partner', 'Received', 'Withdrawn', 'Net']}
            right={[1, 2, 3]}
            rows={partnerRows.map((p) => [p.name, fmt(p.in), fmt(p.out), fmt(p.in - p.out)])}
            foot={['Total', fmt(injected), fmt(withdrawn), fmt(injected - withdrawn)]}
          />
          <OpenLink goTo={goTo} label="Open Capital" onClick={() => goTo?.('capital')} />
        </div>
      )}
    </>
  )
}
