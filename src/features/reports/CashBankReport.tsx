import { useBankAccounts } from '../../lib/queries/masters'
import { useCashAndBankLines } from '../../lib/queries/ledger'
import { useAccountOpenings } from '../../lib/queries/openings'
import { inRange } from '../../lib/calc/period'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function CashBankReport({ range }: { range: DateRange | null }) {
  const { data: accounts } = useBankAccounts()
  const { data: lines } = useCashAndBankLines()
  const { data: openings } = useAccountOpenings()

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

  // Each account counts from its opening balance's date; with none set it is left out of the total.
  const startOf = (bankAccountId: string | null) => (openings ?? []).find((o) => o.bank_account_id === bankAccountId)?.as_on ?? null
  const rows = [{ id: 'cash', bankAccountId: null as string | null, name: 'Cash' }, ...(accounts ?? []).map((acc) => ({ id: acc.id, bankAccountId: acc.id as string | null, name: acc.name }))].map((a) => {
    const accLines = linesFor(a.bankAccountId)
    const startedOn = startOf(a.bankAccountId)
    return {
      id: a.id,
      name: a.name,
      startedOn,
      in: movedIn(accLines, true),
      out: movedOut(accLines, true),
      balance: startedOn ? movedIn(accLines, false) - movedOut(accLines, false) : null,
    }
  })
  const totalBalance = rows.reduce((s, r) => s + (r.balance ?? 0), 0)

  const sections: ExportSection[] = [
    {
      title: 'Cash & bank report',
      columns: ['Account', 'Counted from', 'In (period)', 'Out (period)', 'Balance (to date)'],
      rows: [...rows.map((r): (string | number)[] => [r.name, r.startedOn ? fmtDate(r.startedOn) : 'Opening balance not set', r.in, r.out, r.balance ?? '']), ['Total', '', '', '', totalBalance]],
      numericColumns: [2, 3, 4],
      boldRows: [rows.length],
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        The real accounting position — every expense payment, invoice payment received, vendor bill payment, and
        site imprest movement that touched Cash or a bank account, not just what's logged in Transfers. Each account is
        counted from the date of its opening balance; older entries are saved but not counted yet, and an account with no
        opening balance is left out (set it in Reports &gt; Opening and monthly balances).
      </div>
      <ReportExportButtons title="Cash & bank report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th>Counted from</th>
              <th style={{ textAlign: 'right' }}>In (period)</th>
              <th style={{ textAlign: 'right' }}>Out (period)</th>
              <th style={{ textAlign: 'right' }}>Balance (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.startedOn ? fmtDate(r.startedOn) : <span className="retention-note">Opening balance not set</span>}</td>
                <td className="amt">{fmt(r.in)}</td>
                <td className="amt">{fmt(r.out)}</td>
                <td className="amt">{r.balance === null ? '—' : fmt(r.balance)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td>
              <td></td>
              <td></td>
              <td></td>
              <td className="amt">{fmt(totalBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
