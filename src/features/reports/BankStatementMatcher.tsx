import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/ui'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { useGoTo } from '../../lib/navContext'
import { resolveEntryTarget } from '../../lib/entryTarget'
import { RecordFromStatement } from './RecordFromStatement'
import { matchStatement, type ForcedPair, type LedgerCandidate, type StatementMatch } from '../../lib/calc/bankMatch'
import {
  closingBalance,
  detectMapping,
  extractLines,
  findHeaderRow,
  parseCsv,
  parseStatementDate,
  type ColumnMapping,
  type StatementLine,
} from '../../lib/import/bankStatement'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'
import type { BankLineRow } from '../../lib/queries/books'
import { ReportExportButtons } from './ReportExportButtons'
import { BankSplitView } from './BankSplitView'
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

// The statement is kept for the session, so going to another screen to enter or change something does not lose it.
interface StoredStatement {
  fileName: string
  rows: unknown[][]
  headerRow: number
  mapping: ColumnMapping
  days: number
  forced: ForcedPair[]
}
const storeKeyOf = (bankId: string) => `lis.bankStatement.${bankId}`
function loadStored(bankId: string): StoredStatement | null {
  try {
    const raw = sessionStorage.getItem(storeKeyOf(bankId))
    return raw ? (JSON.parse(raw) as StoredStatement) : null
  } catch {
    return null
  }
}
/** Dates read from Excel become plain YYYY-MM-DD text, so they survive being saved and read back. */
function plainCells(table: unknown[][]): unknown[][] {
  return table.map((row) => row.map((c) => (c instanceof Date ? parseStatementDate(c) ?? '' : c)))
}

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
  bankId,
  bankName,
  ledger,
  clearedIds,
  onStatementRead,
  onTick,
  ticking,
  onPendingChange,
}: {
  bankId: string
  bankName: string
  ledger: BankLineRow[]
  clearedIds: Set<string>
  /** Called with the statement's last date and closing balance when a file is read. */
  onStatementRead: (info: { lastDate: string; closing: number | null }) => void
  onTick: (ledgerLineIds: string[]) => Promise<void>
  ticking: boolean
  /** Reports how many matched lines are still waiting to be ticked. */
  onPendingChange?: (count: number) => void
}) {
  const goTo = useGoTo()
  const [restored] = useState(() => loadStored(bankId))
  const [fileName, setFileName] = useState(restored?.fileName ?? '')
  const [readError, setReadError] = useState<string | null>(null)
  const [rows, setRows] = useState<unknown[][] | null>(restored?.rows ?? null)
  const [headerRow, setHeaderRow] = useState(restored?.headerRow ?? -1)
  const [mapping, setMapping] = useState<ColumnMapping | null>(restored?.mapping ?? null)
  const [days, setDays] = useState(restored?.days ?? 7)
  const [recording, setRecording] = useState<StatementLine | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'lists' | 'split'>('lists')
  // Pairings the user chose by hand (a statement line and the book entry it really is).
  const [forced, setForced] = useState<ForcedPair[]>(restored?.forced ?? [])

  const headers = useMemo(() => (rows && headerRow >= 0 ? rows[headerRow].map((c) => String(c ?? '').trim()) : []), [rows, headerRow])
  const lines = useMemo(() => (rows && mapping ? extractLines(rows, headerRow, mapping) : []), [rows, headerRow, mapping])
  const candidates = useMemo<LedgerCandidate[]>(() => ledger.map((l) => ({ ...l, cleared: clearedIds.has(l.id) })), [ledger, clearedIds])
  const result = useMemo(() => matchStatement(lines, candidates, { days, forced }), [lines, candidates, days, forced])
  const statementOnlyNet = Math.round(result.statementOnly.reduce((s, l) => s + l.deposit - l.withdrawal, 0) * 100) / 100

  // Keep the statement for this session.
  useEffect(() => {
    try {
      if (!rows || !mapping) {
        sessionStorage.removeItem(storeKeyOf(bankId))
        return
      }
      const json = JSON.stringify({ fileName, rows, headerRow, mapping, days, forced } satisfies StoredStatement)
      if (json.length < 4_000_000) sessionStorage.setItem(storeKeyOf(bankId), json)
    } catch {
      // Storage full or blocked: the statement just will not survive leaving the page.
    }
  }, [bankId, fileName, rows, headerRow, mapping, days, forced])

  // When the page is opened again with a kept statement, tell the page its date and closing balance.
  useEffect(() => {
    if (restored && lines.length > 0) {
      const last = lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date)
      onStatementRead({ lastDate: last, closing: closingBalance(lines)?.balance ?? null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function removeStatement() {
    setRows(null)
    setMapping(null)
    setHeaderRow(-1)
    setFileName('')
    setForced([])
    setReadError(null)
  }

  async function openEntry(l: { sourceTable?: string | null; sourceId?: string | null; date: string }) {
    const target = await resolveEntryTarget(l.sourceTable, l.sourceId, l.date)
    if (!target || !goTo) {
      toast('info', `I cannot open this one directly. Look for it dated ${fmtDate(l.date)} in its own screen.`)
      return
    }
    toast('info', 'Your statement is kept. Come back through Reports, then Bank reconciliation.')
    goTo(target.tab, { costCenter: target.costCenter, filter: target.filter })
  }

  useEffect(() => {
    onPendingChange?.(result.toTick.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.toTick.length])

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
      table = plainCells(table)
      const read = extractLines(table, at, map)
      setRows(table)
      setHeaderRow(at)
      setMapping(map)
      setFileName(file.name)
      setForced([])
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
                <button type="button" className="btn link" style={{ float: 'right', padding: '0 0 0 12px' }} onClick={removeStatement}>
                  Remove this statement
                </button>
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

              <div role="group" aria-label="How to show the results" style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                <Button type="button" variant={view === 'lists' ? 'primary' : 'secondary'} onClick={() => setView('lists')} aria-pressed={view === 'lists'}>
                  Lists
                </Button>
                <Button type="button" variant={view === 'split' ? 'primary' : 'secondary'} onClick={() => setView('split')} aria-pressed={view === 'split'}>
                  Side by side
                </Button>
              </div>

              {view === 'split' ? (
                <>
                  <BankSplitView
                    lines={lines}
                    ledger={candidates}
                    result={result}
                    days={days}
                    picked={picked}
                    onPick={(id, on) => {
                      const next = new Set(picked)
                      if (on) next.add(id)
                      else next.delete(id)
                      setPicked(next)
                    }}
                    onForce={(statementRow, ledgerId) =>
                      setForced((cur) => [...cur.filter((f) => f.statementRow !== statementRow && f.ledgerId !== ledgerId), { statementRow, ledgerId }])
                    }
                    onUnforce={(statementRow) => setForced((cur) => cur.filter((f) => f.statementRow !== statementRow))}
                    onRecord={setRecording}
                    onOpen={(l) => void openEntry(l)}
                  />
                  <div style={{ marginTop: 10 }}>
                    <Button type="button" onClick={() => void tickPicked()} disabled={picked.size === 0 || ticking}>
                      Tick {picked.size} selected
                    </Button>
                  </div>
                </>
              ) : (
                <>
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
                              {m.ledger.sourceTable && (
                                <button type="button" className="btn link" style={{ padding: 0, fontSize: 12 }} onClick={() => void openEntry(m.ledger)}>
                                  Open this entry
                                </button>
                              )}
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
                actions={(i) => (
                  <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRecording(result.statementOnly[i])}>
                    Record this
                  </button>
                )}
              />

              <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>In your books, not on the statement ({result.booksOnly.length})</h4>
              <div className="note" style={{ marginTop: 0 }}>
                Usually a cheque or transfer that has not cleared yet. If it is old, check it.
              </div>
              <PileTable
                empty="Everything in your books for this period is on the statement."
                head={['Date', 'Entry', 'Amount']}
                rows={result.booksOnly.map((l) => [fmtDate(l.date), l.description, `${l.deposit > 0 ? '+' : '-'}${fmt2(amountOf(l))}`])}
                actions={(i) =>
                  result.booksOnly[i].sourceTable ? (
                    <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void openEntry(result.booksOnly[i])}>
                      Open this entry
                    </button>
                  ) : null
                }
              />
                </>
              )}
            </>
          )}
        </>
      )}
      {recording && <RecordFromStatement line={recording} bankAccountId={bankId} bankName={bankName} onClose={() => setRecording(null)} />}
    </div>
  )
}

function PileTable({ head, rows, empty, actions }: { head: string[]; rows: string[][]; empty: string; actions?: (index: number) => React.ReactNode }) {
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
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length + (actions ? 1 : 0)} className="empty-row">
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
              {actions && <td style={{ textAlign: 'right' }}>{actions(i)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
