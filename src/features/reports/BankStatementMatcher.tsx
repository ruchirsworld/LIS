import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/ui'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { matchStatement, type LedgerCandidate, type StatementMatch } from '../../lib/calc/bankMatch'
import {
  closingBalance,
  detectMapping,
  extractLines,
  findHeaderRow,
  parseCsv,
  type ColumnMapping,
} from '../../lib/import/bankStatement'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'
import type { BankLineRow } from '../../lib/queries/books'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'reference', label: 'Cheque or reference' },
  { key: 'withdrawal', label: 'Money out (withdrawal or debit)' },
  { key: 'deposit', label: 'Money in (deposit or credit)' },
  { key: 'amount', label: 'Single amount column' },
  { key: 'drcr', label: 'Dr/Cr column' },
  { key: 'balance', label: 'Balance' },
]

const amountOf = (l: { deposit: number; withdrawal: number }) => (l.deposit > 0 ? l.deposit : l.withdrawal)
const sideOf = (l: { deposit: number }) => (l.deposit > 0 ? 'In' : 'Out')

function matchNote(m: StatementMatch): string {
  const parts: string[] = []
  parts.push(m.dayGap === 0 ? 'same day' : `${m.dayGap} day${m.dayGap === 1 ? '' : 's'} apart`)
  if (m.ambiguous) parts.push('another entry has the same amount, check it')
  return parts.join(', ')
}

/** Upload the bank's statement; the lines are matched to the books and the matches can be ticked in one go. */
export function BankStatementMatcher({
  bankName,
  ledger,
  clearedIds,
  onStatementRead,
  onTick,
  ticking,
}: {
  bankName: string
  ledger: BankLineRow[]
  clearedIds: Set<string>
  /** Called with the statement's last date and closing balance when a file is read. */
  onStatementRead: (info: { lastDate: string; closing: number | null }) => void
  onTick: (ledgerLineIds: string[]) => Promise<void>
  ticking: boolean
}) {
  const [fileName, setFileName] = useState('')
  const [readError, setReadError] = useState<string | null>(null)
  const [rows, setRows] = useState<unknown[][] | null>(null)
  const [headerRow, setHeaderRow] = useState(-1)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [days, setDays] = useState(7)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const headers = useMemo(() => (rows && headerRow >= 0 ? rows[headerRow].map((c) => String(c ?? '').trim()) : []), [rows, headerRow])
  const lines = useMemo(() => (rows && mapping ? extractLines(rows, headerRow, mapping) : []), [rows, headerRow, mapping])
  const candidates = useMemo<LedgerCandidate[]>(() => ledger.map((l) => ({ ...l, cleared: clearedIds.has(l.id) })), [ledger, clearedIds])
  const result = useMemo(() => matchStatement(lines, candidates, { days }), [lines, candidates, days])
  const statementOnlyNet = Math.round(result.statementOnly.reduce((s, l) => s + l.deposit - l.withdrawal, 0) * 100) / 100

  // Start with the safe matches ticked; ones that are far apart in date, or could be another entry, are left for a look.
  useEffect(() => {
    setPicked(new Set(result.toTick.filter((m) => !m.ambiguous && m.confidence !== 'loose').map((m) => m.ledger.id)))
  }, [result])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReadError(null)
    try {
      let table: unknown[][] = []
      let at = -1
      if (/\.(csv|txt)$/i.test(file.name)) {
        table = parseCsv(await file.text())
        at = findHeaderRow(table)
      } else {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
        for (const name of wb.SheetNames) {
          const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
          const found = findHeaderRow(sheetRows)
          if (found >= 0) {
            table = sheetRows
            at = found
            break
          }
        }
      }
      if (at < 0) {
        setRows(null)
        setReadError('I could not find the table of transactions in this file. It needs a Date column and either Withdrawal and Deposit columns, Debit and Credit columns, or one Amount column.')
        return
      }
      const map = detectMapping(table[at].map((c) => String(c ?? '').trim()))
      const read = extractLines(table, at, map)
      setRows(table)
      setHeaderRow(at)
      setMapping(map)
      setFileName(file.name)
      if (read.length === 0) {
        setReadError('The table was found but no transaction lines could be read. Check the columns below.')
        return
      }
      const last = read.reduce((m, l) => (l.date > m ? l.date : m), read[0].date)
      onStatementRead({ lastDate: last, closing: closingBalance(read)?.balance ?? null })
    } catch (err) {
      setRows(null)
      setReadError(getErrorMessage(err, 'Could not read that file.'))
    }
  }

  async function tickPicked() {
    try {
      await onTick([...picked])
      toast('success', `${picked.size} line${picked.size === 1 ? '' : 's'} ticked off against the statement.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the ticks.'))
    }
  }

  const sections: ExportSection[] = lines.length
    ? [
        {
          title: 'Matched to the books',
          columns: ['Statement date', 'Statement text', 'In', 'Out', 'Books date', 'Books entry'],
          rows: [...result.toTick, ...result.alreadyTicked].map((m) => [
            fmtDate(m.statement.date),
            m.statement.description,
            m.statement.deposit,
            m.statement.withdrawal,
            fmtDate(m.ledger.date),
            m.ledger.description,
          ]),
          numericColumns: [2, 3],
          decimals: 2,
        },
        {
          title: 'On the statement, not in the books',
          columns: ['Date', 'Description', 'Reference', 'In', 'Out'],
          rows: result.statementOnly.map((l) => [fmtDate(l.date), l.description, l.reference, l.deposit, l.withdrawal]),
          numericColumns: [3, 4],
          decimals: 2,
        },
        {
          title: 'In the books, not on the statement',
          columns: ['Date', 'Entry', 'In', 'Out'],
          rows: result.booksOnly.map((l) => [fmtDate(l.date), l.description, l.deposit, l.withdrawal]),
          numericColumns: [2, 3],
          decimals: 2,
        },
      ]
    : []

  return (
    <div style={{ margin: '4px 0 16px' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Match with the bank statement</h3>
      <div className="note" style={{ marginTop: 0 }}>
        Download the statement for {bankName || 'this account'} from net banking as Excel or CSV (not PDF) and choose it here. Each line is matched to your books
        by amount and date, and you can tick the matches in one go.
      </div>
      <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(e) => void onFile(e)} aria-label="Bank statement file" />
      {readError && (
        <div role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>
          {readError}
        </div>
      )}

      {rows && mapping && (
        <>
          <details style={{ margin: '10px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>Check which column is which (change it if a column was guessed wrong)</summary>
            <div className="form-grid" style={{ marginTop: 8 }}>
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`map-${f.key}`}>{f.label}</label>
                  <select
                    id={`map-${f.key}`}
                    value={mapping[f.key] === null ? '' : String(mapping[f.key])}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">(none)</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>

          {lines.length > 0 && (
            <>
              <div className="note" style={{ fontWeight: 600 }}>
                {fileName}: {lines.length} line{lines.length === 1 ? '' : 's'}, {fmtDate(lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date))} to{' '}
                {fmtDate(lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date))}. {result.toTick.length + result.alreadyTicked.length} match your books
                ({result.alreadyTicked.length} already ticked), {result.statementOnly.length} are on the statement only, {result.booksOnly.length} are in your books only.
              </div>
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor="match-days">Match dates that are within</label>
                <select id="match-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={3}>3 days of each other</option>
                  <option value={7}>7 days of each other</option>
                  <option value={15}>15 days of each other</option>
                </select>
              </div>
              <ReportExportButtons title="Bank statement matching" sections={sections} range={null} fileNamePrefix={`Statement_Matching_${bankName}`} />

              <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>Ready to tick ({result.toTick.length})</h4>
              {result.toTick.length === 0 ? (
                <div className="note">Nothing new to tick.</div>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="data">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input
                              type="checkbox"
                              aria-label="Select all matches"
                              checked={picked.size === result.toTick.length}
                              onChange={(e) => setPicked(e.target.checked ? new Set(result.toTick.map((m) => m.ledger.id)) : new Set())}
                            />
                          </th>
                          <th>Statement</th>
                          <th>In your books</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>How close</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.toTick.map((m) => (
                          <tr key={m.ledger.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Tick ${m.ledger.description}`}
                                checked={picked.has(m.ledger.id)}
                                onChange={(e) => {
                                  const next = new Set(picked)
                                  if (e.target.checked) next.add(m.ledger.id)
                                  else next.delete(m.ledger.id)
                                  setPicked(next)
                                }}
                              />
                            </td>
                            <td>
                              {fmtDate(m.statement.date)}
                              <div className="retention-note">{m.statement.description}</div>
                            </td>
                            <td>
                              {fmtDate(m.ledger.date)}
                              <div className="retention-note">{m.ledger.description}</div>
                            </td>
                            <td className="amt">
                              {sideOf(m.statement) === 'In' ? '+' : '-'}
                              {fmt2(amountOf(m.statement))}
                            </td>
                            <td style={{ color: m.ambiguous || m.confidence === 'loose' ? 'var(--amber)' : undefined }}>{matchNote(m)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Button type="button" onClick={() => void tickPicked()} disabled={picked.size === 0 || ticking}>
                      Tick {picked.size} selected
                    </Button>
                  </div>
                </>
              )}

              <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>On the statement, not in your books ({result.statementOnly.length})</h4>
              <div className="note" style={{ marginTop: 0 }}>
                Usually bank charges, interest, or a payment or receipt that has not been entered yet. Enter these in the app, then upload again.
                {result.statementOnly.length > 0 && (
                  <>
                    {' '}
                    Together they come to <strong>{statementOnlyNet >= 0 ? '+' : '-'}{fmt2(Math.abs(statementOnlyNet))}</strong>. After you tick the matches, that is the difference
                    you should still see below; once these are entered, it should be nil.
                  </>
                )}
              </div>
              <PileTable
                empty="Every statement line is in your books."
                head={['Date', 'Description', 'Amount']}
                rows={result.statementOnly.map((l) => [fmtDate(l.date), l.description || l.reference, `${l.deposit > 0 ? '+' : '-'}${fmt2(amountOf(l))}`])}
              />

              <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>In your books, not on the statement ({result.booksOnly.length})</h4>
              <div className="note" style={{ marginTop: 0 }}>
                Usually a cheque or transfer that has not cleared yet. If it is old, check it.
              </div>
              <PileTable
                empty="Everything in your books for this period is on the statement."
                head={['Date', 'Entry', 'Amount']}
                rows={result.booksOnly.map((l) => [fmtDate(l.date), l.description, `${l.deposit > 0 ? '+' : '-'}${fmt2(amountOf(l))}`])}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

function PileTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} style={i === head.length - 1 ? { textAlign: 'right' } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="empty-row">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === r.length - 1 ? 'amt' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
