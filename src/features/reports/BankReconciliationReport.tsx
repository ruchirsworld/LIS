import { useMemo, useState } from 'react'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { summariseReconciliation } from '../../lib/calc/bankReconciliation'
import { useBankAccounts } from '../../lib/queries/masters'
import { useBankLines, useClearedBankLines, useCompanyProfile, useSetBankLineCleared } from '../../lib/queries/books'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'
import { companyHeaderLine } from '../invoices/ledgerExport'
import { ReportExportButtons } from './ReportExportButtons'
import { BankStatementMatcher } from './BankStatementMatcher'
import { BankSignoff } from './BankSignoff'
import type { ExportSection } from '../../lib/export/report'

const today = () => new Date().toISOString().slice(0, 10)

/** Match a bank account's ledger against its statement: tick each line you can
 * see on the statement, enter the statement's closing balance, and what is left
 * over is exactly what still needs explaining. */
export function BankReconciliationReport() {
  const { data: accounts } = useBankAccounts()
  const { data: company } = useCompanyProfile()
  const [bankId, setBankId] = useState<string | null>(null)
  const [statementDate, setStatementDate] = useState(today())
  const [balanceText, setBalanceText] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [pendingMatches, setPendingMatches] = useState(0)

  const selected = bankId ?? accounts?.[0]?.id ?? null
  const { data: lines } = useBankLines(selected)
  const { data: clearedMap } = useClearedBankLines(selected)
  const setCleared = useSetBankLineCleared(selected)

  const cleared = useMemo(() => new Set(clearedMap?.keys() ?? []), [clearedMap])
  const statementBalance = Number(balanceText.replace(/[₹,\s]/g, '')) || 0
  const summary = useMemo(
    () => summariseReconciliation(lines ?? [], cleared, statementBalance, statementDate),
    [lines, cleared, statementBalance, statementDate]
  )

  const accountName = accounts?.find((a) => a.id === selected)?.name ?? ''
  const visible = (lines ?? []).filter((l) => l.date <= statementDate && (showAll || !cleared.has(l.id)))
  const agrees = balanceText.trim() !== '' && Math.abs(summary.difference) < 0.01

  async function toggle(ids: string[], tick: boolean) {
    try {
      await setCleared.mutateAsync({ lineIds: ids, cleared: tick, clearedOn: statementDate })
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save that tick.'))
    }
  }

  const sections: ExportSection[] = [
    {
      title: `Bank reconciliation - ${accountName} - as on ${fmtDate(statementDate)}`,
      columns: ['Particulars', 'Amount'],
      rows: [
        ['Balance as per books', summary.bookBalance],
        ['Less: deposits not yet on the statement', -summary.unclearedDeposits],
        ['Add: payments not yet on the statement', summary.unclearedWithdrawals],
        ['Balance expected on the statement', summary.expectedStatementBalance],
        ['Balance as per bank statement', statementBalance],
        ['Difference to explain', summary.difference],
      ],
      numericColumns: [1],
      decimals: 2,
      boldRows: [3, 5],
    },
    {
      title: 'Not yet on the statement',
      columns: ['Date', 'Particulars', 'Deposit', 'Payment'],
      rows: (lines ?? []).filter((l) => l.date <= statementDate && !cleared.has(l.id)).map((l) => [fmtDate(l.date), l.description, l.deposit, l.withdrawal]),
      numericColumns: [2, 3],
      decimals: 2,
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Open the bank statement. Tick every line below that you can see on it, then type the statement's closing balance. When the difference is nil, the
        books and the bank agree. Anything left unticked is a cheque or deposit that has not reached the bank yet — or a mistake to chase.
      </div>

      <div className="form-grid" style={{ margin: '12px 0' }}>
        <div className="field">
          <label htmlFor="rec-bank">Bank account</label>
          <select id="rec-bank" value={selected ?? ''} onChange={(e) => setBankId(e.target.value)}>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rec-date">Statement date</label>
          <input id="rec-date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rec-balance">Closing balance on the statement</label>
          <input id="rec-balance" inputMode="decimal" placeholder="0.00" value={balanceText} onChange={(e) => setBalanceText(e.target.value)} />
        </div>
      </div>

      {!accounts?.length && <div className="empty-row">No bank accounts yet. Add one in Settings.</div>}

      {selected && lines && (
        <BankStatementMatcher
          key={selected}
          bankId={selected}
          bankName={accountName}
          ledger={lines}
          clearedIds={cleared}
          ticking={setCleared.isPending}
          onStatementRead={({ lastDate, closing }) => {
            setStatementDate(lastDate)
            if (closing !== null) setBalanceText(String(closing))
          }}
          onTick={(ids) => setCleared.mutateAsync({ lineIds: ids, cleared: true, clearedOn: statementDate })}
          onPendingChange={setPendingMatches}
        />
      )}

      {selected && (
        <>
          <div className="table-scroll">
            <table className="data">
              <tbody>
                <tr>
                  <td>Balance as per books on {fmtDate(statementDate)}</td>
                  <td className="amt">{fmt2(summary.bookBalance)}</td>
                </tr>
                <tr>
                  <td>Less: deposits not yet on the statement</td>
                  <td className="amt">{fmt2(-summary.unclearedDeposits)}</td>
                </tr>
                <tr>
                  <td>Add: payments not yet on the statement</td>
                  <td className="amt">{fmt2(summary.unclearedWithdrawals)}</td>
                </tr>
                <tr style={{ fontWeight: 600 }}>
                  <td>Balance expected on the statement</td>
                  <td className="amt">{fmt2(summary.expectedStatementBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="note" style={{ color: balanceText.trim() === '' ? undefined : agrees ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {balanceText.trim() === ''
              ? 'Enter the statement balance to see the difference.'
              : agrees
                ? 'The books and the bank statement agree.'
                : `Difference to explain: ${fmt2(summary.difference)}`}
          </div>

          {lines && (
            <BankSignoff
              key={selected}
              bankId={selected}
              bankName={accountName}
              statementDate={statementDate}
              balanceText={balanceText}
              statementBalance={statementBalance}
              summary={summary}
              ledger={lines}
              pendingMatches={pendingMatches}
            />
          )}

          <ReportExportButtons title="Bank reconciliation" sections={sections} range={null} headerNote={companyHeaderLine(company)} fileNamePrefix={`Bank_Reconciliation_${accountName}`} />

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0 6px', fontSize: 13 }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Also show lines already ticked
          </label>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Tick all shown"
                      checked={visible.length > 0 && visible.every((l) => cleared.has(l.id))}
                      onChange={(e) => void toggle(visible.map((l) => l.id), e.target.checked)}
                    />
                  </th>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th style={{ textAlign: 'right' }}>Deposit</th>
                  <th style={{ textAlign: 'right' }}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      {lines ? 'Nothing left to tick up to this date.' : 'Loading…'}
                    </td>
                  </tr>
                )}
                {visible.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`On the statement: ${l.description}`}
                        checked={cleared.has(l.id)}
                        onChange={(e) => void toggle([l.id], e.target.checked)}
                      />
                    </td>
                    <td>{fmtDate(l.date)}</td>
                    <td>{l.description}</td>
                    <td className="amt">{l.deposit ? fmt2(l.deposit) : ''}</td>
                    <td className="amt">{l.withdrawal ? fmt2(l.withdrawal) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
