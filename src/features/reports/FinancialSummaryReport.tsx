import { KpiCard } from '../../components/ui'
import { useReportSummary } from '../../lib/queries/reports'
import { useInvoices } from '../../lib/queries/invoices'
import { useLoans, useLoanPayments } from '../../lib/queries/loans'
import { useCapitalTx } from '../../lib/queries/capital'
import { useProfiles } from '../../lib/queries/admin'
import { fmt } from '../../lib/calc/format'
import { netPayable } from '../../lib/calc/invoices'
import { totalInterestDue } from '../../lib/calc/loans'
import { partnerNet } from '../../lib/calc/capital'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function FinancialSummaryReport({ range }: { range: DateRange | null }) {
  const { data: summary } = useReportSummary(range)

  const { data: invoices } = useInvoices(range)
  const { data: loans } = useLoans(null)
  const { data: loanPayments } = useLoanPayments()
  const { data: profiles } = useProfiles()
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

  // Capital positions are running balances too, not period-scoped.
  const partnerRows = (profiles ?? []).map((p) => {
    const { injected, withdrawn } = partnerNet(p.id, capitalTx ?? [])
    return { id: p.id, name: p.name, net: withdrawn - injected }
  })

  const metrics: [string, number][] = [
    ['Total received', summary?.total_received ?? 0],
    ['Invoice due (to send)', invoiceDueToSend],
    ['Total purchases', summary?.vendor_purchases ?? 0],
    ['Interest due', interestDue],
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
