import { useTrialBalance } from '../../lib/queries/reports'
import { fmt } from '../../lib/calc/format'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

// A trial balance is a running snapshot of the ledger, not a period report —
// the period filter above this component doesn't apply here, unlike every
// other report in the catalog.
export function TrialBalanceReport() {
  const { data: rows } = useTrialBalance()

  const totalDebit = (rows ?? []).reduce((s, r) => s + Number(r.total_debit || 0), 0)
  const totalCredit = (rows ?? []).reduce((s, r) => s + Number(r.total_credit || 0), 0)

  const sections: ExportSection[] = [
    {
      title: 'Trial balance',
      columns: ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'],
      rows: (rows ?? []).map((r) => [r.code ?? '', r.name ?? '', r.account_type ?? '', r.total_debit ?? 0, r.total_credit ?? 0, r.balance ?? 0]),
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        As-of-now snapshot of every GL account — not scoped to the period filter above.
      </div>
      <ReportExportButtons title="Trial balance" sections={sections} range={null} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No ledger activity yet
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.code}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.account_type}</td>
                <td className="amt">{fmt(r.total_debit ?? 0)}</td>
                <td className="amt">{fmt(r.total_credit ?? 0)}</td>
                <td className="amt">{fmt(r.balance ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ fontWeight: 600 }}>
                Total
              </td>
              <td className="amt" style={{ fontWeight: 600 }}>
                {fmt(totalDebit)}
              </td>
              <td className="amt" style={{ fontWeight: 600 }}>
                {fmt(totalCredit)}
              </td>
              <td className="amt" style={{ fontWeight: 600, color: Math.abs(totalDebit - totalCredit) < 0.01 ? undefined : 'var(--red)' }}>
                {fmt(totalDebit - totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
