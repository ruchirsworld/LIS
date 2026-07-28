import { useBankAccounts } from '../../lib/queries/masters'
import { useTransfers } from '../../lib/queries/transfers'
import { accountBalance, cashBalance } from '../../lib/calc/transfers'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function CashBankReport({ range }: { range: DateRange | null }) {
  const { data: accounts } = useBankAccounts()
  const { data: transfers } = useTransfers(null)

  const from = range?.from ?? null
  const to = range?.to ?? null
  const all = transfers ?? []
  const periodTransfers = all.filter((t) => inRange(t.date, from, to))

  function movedIn(accountId: string | null, list: typeof all) {
    return list.filter((t) => t.to_account_id === accountId).reduce((s, t) => s + Number(t.amount || 0), 0)
  }
  function movedOut(accountId: string | null, list: typeof all) {
    return list.filter((t) => t.from_account_id === accountId).reduce((s, t) => s + Number(t.amount || 0), 0)
  }

  const rows = [
    { id: 'cash', name: 'Cash', in: movedIn(null, periodTransfers), out: movedOut(null, periodTransfers), balance: cashBalance(all) },
    ...(accounts ?? []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      in: movedIn(acc.id, periodTransfers),
      out: movedOut(acc.id, periodTransfers),
      balance: accountBalance(acc.id, acc.opening_balance ?? 0, all),
    })),
  ]

  const sections: ExportSection[] = [
    {
      title: 'Cash & bank report',
      columns: ['Account', 'In (period)', 'Out (period)', 'Balance (to date)'],
      rows: rows.map((r) => [r.name, r.in, r.out, r.balance]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Cash & bank report</summary>
      <ReportExportButtons title="Cash & bank report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>In (period)</th>
              <th style={{ textAlign: 'right' }}>Out (period)</th>
              <th style={{ textAlign: 'right' }}>Balance (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="amt">{fmt(r.in)}</td>
                <td className="amt">{fmt(r.out)}</td>
                <td className="amt">{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
