import { useBankAccounts } from '../../lib/queries/masters'
import { useCashAndBankLines } from '../../lib/queries/ledger'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function CashBankReport({ range }: { range: DateRange | null }) {
  const { data: accounts } = useBankAccounts()
  const { data: lines } = useCashAndBankLines()

  const from = range?.from ?? null
  const to = range?.to ?? null
  const all = lines ?? []

  function linesFor(bankAccountId: string | null) {
    return all.filter((l) => l.bank_account_id === bankAccountId)
  }
  function movedIn(list: typeof all, periodOnly: boolean) {
    return list
      .filter((l) => !periodOnly || inRange(l.date, from, to))
      .reduce((s, l) => s + l.debit, 0)
  }
  function movedOut(list: typeof all, periodOnly: boolean) {
    return list
      .filter((l) => !periodOnly || inRange(l.date, from, to))
      .reduce((s, l) => s + l.credit, 0)
  }

  const rows = [
    {
      id: 'cash',
      name: 'Cash',
      in: movedIn(linesFor(null), true),
      out: movedOut(linesFor(null), true),
      balance: movedIn(linesFor(null), false) - movedOut(linesFor(null), false),
    },
    ...(accounts ?? []).map((acc) => {
      const accLines = linesFor(acc.id)
      return {
        id: acc.id,
        name: acc.name,
        in: movedIn(accLines, true),
        out: movedOut(accLines, true),
        balance: movedIn(accLines, false) - movedOut(accLines, false),
      }
    }),
  ]

  const sections: ExportSection[] = [
    {
      title: 'Cash & bank report',
      columns: ['Account', 'In (period)', 'Out (period)', 'Balance (to date)'],
      rows: rows.map((r) => [r.name, r.in, r.out, r.balance]),
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        The real accounting position — every expense payment, invoice payment received, vendor bill payment, and
        site imprest movement that touched Cash or a bank account, not just what's logged in Transfers.
      </div>
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
    </div>
  )
}
