import { useLoans, useLoanPayments } from '../../lib/queries/loans'
import { loanOutstanding } from '../../lib/calc/loans'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function LoanReport({ range }: { range: DateRange | null }) {
  const { data: loans } = useLoans(null)
  const { data: payments } = useLoanPayments()

  const from = range?.from ?? null
  const to = range?.to ?? null

  const rows = (loans ?? []).map((loan) => {
    const loanPayments = payments?.filter((p) => p.loan_id === loan.id) ?? []
    const periodPayments = loanPayments.filter((p) => inRange(p.date, from, to))
    const principalPaid = periodPayments.reduce((s, p) => s + Number(p.principal_paid || 0), 0)
    const interestPaid = periodPayments.reduce((s, p) => s + Number(p.interest_paid || 0), 0)
    const outstanding = loanOutstanding(loan, loanPayments)

    return { id: loan.id, lender: loan.lender, principalPaid, interestPaid, outstanding }
  })

  const sections: ExportSection[] = [
    {
      title: 'Loan report',
      columns: ['Lender', 'Principal paid (period)', 'Interest paid (period)', 'Outstanding (to date)'],
      rows: rows.map((r) => [r.lender, r.principalPaid, r.interestPaid, r.outstanding]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Loan report</summary>
      <ReportExportButtons title="Loan report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Lender</th>
              <th style={{ textAlign: 'right' }}>Principal paid (period)</th>
              <th style={{ textAlign: 'right' }}>Interest paid (period)</th>
              <th style={{ textAlign: 'right' }}>Outstanding (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No loans yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.lender}</td>
                <td className="amt">{fmt(r.principalPaid)}</td>
                <td className="amt">{fmt(r.interestPaid)}</td>
                <td className="amt">{fmt(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
