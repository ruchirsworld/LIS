import { confirmAction } from '../../lib/feedback'
import { useState } from 'react'
import { Button } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useGoTo } from '../../lib/navContext'
import { fmt2, fmtDate } from '../../lib/calc/format'
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  fyLabel,
  fyRange,
  fyStartYearOf,
  netProfitOf,
  type StatementLine,
} from '../../lib/calc/financialStatements'
import { useCompanyProfile, useFirstEntryDate, useGlBalances, useUpdateCompanyProfile } from '../../lib/queries/books'
import { getErrorMessage } from '../../lib/errors'
import { companyHeaderLine } from '../invoices/ledgerExport'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/** Financial years (April to March) from the first entry in the books to now. */
function useFinancialYearChoice() {
  const { data: first } = useFirstEntryDate()
  const currentFy = fyStartYearOf(todayStr())
  const firstFy = first ? fyStartYearOf(first) : currentFy
  const years: number[] = []
  for (let y = currentFy; y >= Math.min(firstFy, currentFy); y--) years.push(y)
  const [fy, setFy] = useState(currentFy)
  return { fy, setFy, years }
}

function FinancialYearBar({
  fy,
  years,
  onChange,
  to,
}: {
  fy: number
  years: number[]
  onChange: (y: number) => void
  to: string
}) {
  const { profile } = useAuth()
  const { data: company } = useCompanyProfile()
  const update = useUpdateCompanyProfile()
  const [error, setError] = useState<string | null>(null)
  const isAdmin = profile?.role === 'admin'
  const locked = company?.books_locked_until ?? null
  const finished = to < todayStr()

  async function lockYear() {
    if (!company) return
    const ok = await confirmAction({
      title: 'Close the year',
      message: `Lock the books up to ${fmtDate(to)}? Nothing dated on or before that can be added, changed or removed afterwards.`,
      confirmLabel: 'Lock the books',
      danger: true,
    })
    if (!ok) return
    setError(null)
    try {
      await update.mutateAsync({ id: company.id, patch: { books_locked_until: to } })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not lock the books.'))
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="field" style={{ maxWidth: 280 }}>
        <label>Financial year</label>
        <select value={fy} onChange={(e) => onChange(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {fyLabel(y)} (Apr {y} - Mar {y + 1})
            </option>
          ))}
        </select>
      </div>
      <div className="note" style={{ flex: 1, minWidth: 220, marginBottom: 6 }}>
        {locked ? `Books locked up to ${fmtDate(locked)}.` : 'No year is locked yet.'}
        {isAdmin && finished && (!locked || locked < to) && (
          <>
            {' '}
            <Button type="button" variant="secondary" onClick={lockYear} disabled={update.isPending}>
              Close the year: lock up to {fmtDate(to)}
            </Button>
          </>
        )}
        {error && <span style={{ color: 'var(--red)' }}> {error}</span>}
      </div>
    </div>
  )
}

function StatementTable({ lines, curLabel, prevLabel }: { lines: StatementLine[]; curLabel: string; prevLabel: string }) {
  return (
    <div className="table-scroll" style={{ marginTop: 14 }}>
      <table className="data stmt">
        <thead>
          <tr>
            <th>Particulars</th>
            <th style={{ textAlign: 'right' }}>{curLabel}</th>
            <th style={{ textAlign: 'right' }}>{prevLabel}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.label}-${i}`} className={`stmt-${l.kind}`}>
              <td style={{ paddingLeft: l.kind === 'line' ? 28 : undefined }}>{l.label}</td>
              <td className="amt">{l.kind === 'heading' ? '' : fmt2(l.cur)}</td>
              <td className="amt">{l.kind === 'heading' ? '' : fmt2(l.prev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function toSection(title: string, subtitle: string[], lines: StatementLine[], curLabel: string, prevLabel: string): ExportSection {
  return {
    title,
    sheetName: title.slice(0, 31),
    subtitle: [title, ...subtitle],
    columns: ['Particulars', curLabel, prevLabel],
    rows: lines.map((l) => [l.kind === 'line' ? `    ${l.label}` : l.label, l.kind === 'heading' ? '' : l.cur, l.kind === 'heading' ? '' : l.prev]),
    numericColumns: [1, 2],
    decimals: 2,
    columnWidths: { 1: 40, 2: 40 },
    boldRows: lines.flatMap((l, i) => (l.kind === 'line' ? [] : [i])),
  }
}

const NOT_RECORDED = 'Prepared from the ledger. Fixed assets, depreciation and income tax are not recorded in LIS, so they are not shown.'

/** Profit and Loss for a financial year, with the year before alongside. */
export function ProfitAndLossReport() {
  const { fy, setFy, years } = useFinancialYearChoice()
  const { data: company } = useCompanyProfile()
  const { from, to } = fyRange(fy)
  const prev = fyRange(fy - 1)
  const upTo = to < todayStr() ? to : todayStr()
  const inProgress = to >= todayStr()

  const { data: curRows } = useGlBalances(from, upTo)
  const { data: prevRows } = useGlBalances(prev.from, prev.to)

  const curLabel = inProgress ? `${fmtDate(from)} to ${fmtDate(upTo)}` : `Year ended ${fmtDate(to)}`
  const prevLabel = `Year ended ${fmtDate(prev.to)}`
  const built = curRows && prevRows ? buildProfitAndLoss(curRows, prevRows) : null
  const title = `Profit and Loss Statement - ${inProgress ? `year to date, FY ${fyLabel(fy)}` : `year ended ${fmtDate(to)}`}`

  return (
    <div className="report-panel">
      <FinancialYearBar fy={fy} years={years} onChange={setFy} to={to} />
      {!built ? (
        <div className="note">Working out the statement…</div>
      ) : (
        <>
          <ReportExportButtons
            title="Profit and Loss Statement"
            sections={[toSection(title, [NOT_RECORDED], built.lines, curLabel, prevLabel)]}
            range={null}
            headerNote={companyHeaderLine(company)}
            fileNamePrefix={`Profit_and_Loss_FY_${fyLabel(fy)}`}
          />
          <StatementTable lines={built.lines} curLabel={curLabel} prevLabel={prevLabel} />
          <div className="note">{NOT_RECORDED} Revenue is counted when an invoice is raised.</div>
        </>
      )}
    </div>
  )
}

/** Balance Sheet as at a financial year end (or today, for the year in progress). */
export function BalanceSheetReport() {
  const { fy, setFy, years } = useFinancialYearChoice()
  const { data: company } = useCompanyProfile()
  const { from, to } = fyRange(fy)
  const prev = fyRange(fy - 1)
  const asAt = to < todayStr() ? to : todayStr()

  const { data: curBal } = useGlBalances(null, asAt)
  const { data: prevBal } = useGlBalances(null, prev.to)
  const { data: curYear } = useGlBalances(from, asAt)
  const { data: prevYear } = useGlBalances(prev.from, prev.to)

  const curLabel = `As at ${fmtDate(asAt)}`
  const prevLabel = `As at ${fmtDate(prev.to)}`
  const ready = curBal && prevBal && curYear && prevYear
  const built = ready ? buildBalanceSheet(curBal, prevBal, { cur: netProfitOf(curYear), prev: netProfitOf(prevYear) }) : null
  const difference = built ? Math.round((built.totals.assets.cur - built.totals.funds.cur) * 100) / 100 : 0

  const goTo = useGoTo()
  const capital = curBal?.find((r) => r.code === '3010')
  const noCapital = !!curBal && Math.abs((capital?.total_credit ?? 0) - (capital?.total_debit ?? 0)) < 0.005
  const bank = curBal?.find((r) => r.code === '1020')
  const bankBalance = bank ? bank.total_debit - bank.total_credit : 0

  const title = `Balance Sheet as at ${fmtDate(asAt)}`

  return (
    <div className="report-panel">
      <FinancialYearBar fy={fy} years={years} onChange={setFy} to={to} />
      {!built ? (
        <div className="note">Working out the statement…</div>
      ) : (
        <>
          <ReportExportButtons
            title="Balance Sheet"
            sections={[toSection(title, [NOT_RECORDED], built.lines, curLabel, prevLabel)]}
            range={null}
            headerNote={companyHeaderLine(company)}
            fileNamePrefix={`Balance_Sheet_FY_${fyLabel(fy)}`}
          />
          <StatementTable lines={built.lines} curLabel={curLabel} prevLabel={prevLabel} />
          <div className="note" style={{ color: Math.abs(difference) < 0.01 ? 'var(--green)' : 'var(--red)' }}>
            {Math.abs(difference) < 0.01
              ? 'The balance sheet balances: total assets equal total equity and liabilities.'
              : `The balance sheet is out by ${fmt2(Math.abs(difference))} — assets and liabilities do not agree. Check the Books health check.`}
          </div>
          {noCapital && bankBalance > 0.5 && (
            <div className="note">
              No partners' capital has been recorded, so the money in the bank shows up as accumulated profit. Enter each amount the partners put in
              (and any they took out) on the Capital page, dated when it happened, and this sheet will show it as partners' capital.{' '}
              {goTo && (
                <Button type="button" variant="secondary" onClick={() => goTo('capital')}>
                  Open Capital
                </Button>
              )}
            </div>
          )}
          <div className="note">{NOT_RECORDED}</div>
        </>
      )}
    </div>
  )
}
