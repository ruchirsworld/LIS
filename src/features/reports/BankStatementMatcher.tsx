import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/ui'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { useGoTo } from '../../lib/navContext'
import { resolveEntryTarget } from '../../lib/entryTarget'
import { RecordFromStatement } from './RecordFromStatement'
import { EditEntryModal } from './EditEntryModal'
import {
  ledgerIdsOf,
  ledgerKeysOf,
  matchStatement,
  statementRowsOf,
  type ForcedPair,
  type LedgerCandidate,
  type ManualGroup,
  type StatementMatch,
} from '../../lib/calc/bankMatch'
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
import { confirmAction, toast } from '../../lib/feedback'
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
  /** Matches made by hand (several lines against one, or one against one). */
  groups?: ManualGroup[]
  /** Pairs the user unmatched: the matcher never joins these again. */
  forbidden?: ForcedPair[]
  /** Older versions kept one-to-one pairings here. */
  forced?: ForcedPair[]
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

/** The system's label, then what the person typed on the entry. */
const labelOf = (l: { description: string; detail?: string }) => (l.detail ? `${l.description} — ${l.detail}` : l.description)

/** Upload the bank's statement; the lines are matched to the books side by side. */
export function BankStatementMatcher({
  bankId,
  bankName,
  ledger,
  clearedIds,
  onStatementRead,
  onTick,
  onUntick,
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
  /** Takes the tick off entries again (when a match that was already ticked is broken). */
  onUntick: (ledgerLineIds: string[]) => Promise<void>
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
  // Only entries on the same day are matched on their own, unless the user widens this.
  const [days, setDays] = useState(restored?.days ?? 0)
  const [recording, setRecording] = useState<StatementLine | null>(null)
  const [editing, setEditing] = useState<LedgerCandidate | null>(null)
  const [groups, setGroups] = useState<ManualGroup[]>(
    () => restored?.groups ?? (restored?.forced ?? []).map((f) => ({ statementRows: [f.statementRow], ledgerKeys: [f.ledgerId] }))
  )
  const [forbidden, setForbidden] = useState<ForcedPair[]>(restored?.forbidden ?? [])
  // Lines ticked for a hand match.
  const [selectedBank, setSelectedBank] = useState<Set<number>>(new Set())
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set())

  const headers = useMemo(() => (rows && headerRow >= 0 ? rows[headerRow].map((c) => String(c ?? '').trim()) : []), [rows, headerRow])
  const lines = useMemo(() => (rows && mapping ? extractLines(rows, headerRow, mapping) : []), [rows, headerRow, mapping])
  const candidates = useMemo<LedgerCandidate[]>(() => ledger.map((l) => ({ ...l, cleared: clearedIds.has(l.id) })), [ledger, clearedIds])
  const result = useMemo(() => matchStatement(lines, candidates, { days, groups, forbidden }), [lines, candidates, days, groups, forbidden])
  const statementOnlyNet = Math.round(result.statementOnly.reduce((s, l) => s + l.deposit - l.withdrawal, 0) * 100) / 100
  const matchCount = result.toTick.length + result.alreadyTicked.length
  const groupCount = [...result.toTick, ...result.alreadyTicked].filter((m) => m.extra?.length || m.extraStatements?.length).length
  const toTickCount = result.toTick.reduce((n, m) => n + ledgerIdsOf(m).length, 0)

  // Keep the statement for this session.
  useEffect(() => {
    try {
      if (!rows || !mapping) {
        sessionStorage.removeItem(storeKeyOf(bankId))
        return
      }
      const json = JSON.stringify({ fileName, rows, headerRow, mapping, days, groups, forbidden } satisfies StoredStatement)
      if (json.length < 4_000_000) sessionStorage.setItem(storeKeyOf(bankId), json)
    } catch {
      // Storage full or blocked: the statement just will not survive leaving the page.
    }
  }, [bankId, fileName, rows, headerRow, mapping, days, groups, forbidden])

  // When the page is opened again with a kept statement, tell the page its date and closing balance.
  useEffect(() => {
    if (restored && lines.length > 0) {
      const last = lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date)
      onStatementRead({ lastDate: last, closing: closingBalance(lines)?.balance ?? null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    onPendingChange?.(result.toTick.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.toTick.length])

  function clearSelection() {
    setSelectedBank(new Set())
    setSelectedBooks(new Set())
  }

  function removeStatement() {
    setRows(null)
    setMapping(null)
    setHeaderRow(-1)
    setFileName('')
    setGroups([])
    setForbidden([])
    clearSelection()
    setReadError(null)
  }

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  /** Join the lines ticked on both sides into one match. The two sides already add up (the screen checks). */
  function matchSelected() {
    const statementRows = [...selectedBank]
    const ledgerKeys = [...selectedBooks]
    // A line can only be in one match, so any hand match it was in before gives way.
    setGroups((cur) => [
      ...cur.filter((g) => !g.statementRows.some((r) => statementRows.includes(r)) && !g.ledgerKeys.some((k) => ledgerKeys.includes(k))),
      { statementRows, ledgerKeys },
    ])
    setForbidden((cur) => cur.filter((f) => !(statementRows.includes(f.statementRow) && ledgerKeys.includes(f.ledgerId))))
    clearSelection()
  }

  /** A wrong match: break it. The statement lines and the entries go back to "no match", and are not joined again. */
  async function unmatch(m: StatementMatch) {
    const ledgerIds = ledgerIdsOf(m)
    const keys = ledgerKeysOf(m)
    const statementRows = statementRowsOf(m)
    if ([m.ledger, ...(m.extra ?? [])].some((l) => l.cleared)) {
      const ok = await confirmAction({
        title: 'Unmatch this?',
        message: 'It was already ticked off. Unmatching also takes the tick off, so the entry counts as not on the statement again.',
        confirmLabel: 'Unmatch',
        danger: true,
      })
      if (!ok) return
      try {
        await onUntick(ledgerIds)
      } catch (err) {
        toast('error', getErrorMessage(err, 'Could not take the tick off.'))
        return
      }
    }
    setGroups((cur) => cur.filter((g) => !g.statementRows.some((r) => statementRows.includes(r)) && !g.ledgerKeys.some((k) => keys.includes(k))))
    setForbidden((cur) => [...cur, ...statementRows.flatMap((r) => keys.map((k) => ({ statementRow: r, ledgerId: k })))])
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
      setGroups([])
      setForbidden([])
      clearSelection()
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

  async function tickAll() {
    try {
      const ids = result.toTick.flatMap(ledgerIdsOf)
      await onTick(ids)
      toast('success', `${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} ticked off against the statement.`)
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
            [m.statement, ...(m.extraStatements ?? [])].map((s) => s.description).join(' + '),
            [m.statement, ...(m.extraStatements ?? [])].reduce((t, s) => t + s.deposit, 0),
            [m.statement, ...(m.extraStatements ?? [])].reduce((t, s) => t + s.withdrawal, 0),
            fmtDate(m.ledger.date),
            [m.ledger, ...(m.extra ?? [])].map(labelOf).join(' + '),
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
          rows: result.booksOnly.map((l) => [fmtDate(l.date), labelOf(l), l.deposit, l.withdrawal]),
          numericColumns: [2, 3],
          decimals: 2,
        },
      ]
    : []

  return (
    <div style={{ margin: '4px 0 16px' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Match with the bank statement</h3>
      <div className="note" style={{ marginTop: 0 }}>
        Download the statement for {bankName || 'this account'} from net banking as Excel or CSV (not PDF) and choose it here. Lines with the same amount on the same day are matched
        for you and shown in green. Lines with no match are red.
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
                {fmtDate(lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date))}. {matchCount} matched{groupCount > 0 ? ` (${groupCount} of them groups)` : ''},{' '}
                {result.statementOnly.length} on the statement only, {result.booksOnly.length} in your books only.
              </div>
              <div className="field" style={{ maxWidth: 300 }}>
                <label htmlFor="match-days">Match on their own when the dates are</label>
                <select id="match-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={0}>the same day</option>
                  <option value={1}>within 1 day of each other</option>
                  <option value={3}>within 3 days of each other</option>
                  <option value={7}>within 7 days of each other</option>
                </select>
              </div>
              <ReportExportButtons title="Bank statement matching" sections={sections} range={null} fileNamePrefix={`Statement_Matching_${bankName}`} />

              <BankSplitView
                lines={lines}
                ledger={candidates}
                result={result}
                days={days}
                selectedBank={selectedBank}
                selectedBooks={selectedBooks}
                onToggleBank={(row) => setSelectedBank((cur) => toggle(cur, row))}
                onToggleBooks={(key) => setSelectedBooks((cur) => toggle(cur, key))}
                onClearSelection={clearSelection}
                onMatchSelected={matchSelected}
                onUnmatch={(m) => void unmatch(m)}
                onRecord={setRecording}
                onEdit={setEditing}
              />

              <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button type="button" onClick={() => void tickAll()} disabled={result.toTick.length === 0 || ticking}>
                  Tick {toTickCount} matched entr{toTickCount === 1 ? 'y' : 'ies'}
                </Button>
                <span className="note" style={{ margin: 0 }}>
                  Look through the green and yellow lines first, and unmatch any that are wrong.
                </span>
              </div>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>What does ticking do?</summary>
                <div className="note">
                  The matching you see here is only a suggestion on your screen. A <strong>tick</strong> is the saved mark that says &ldquo;this entry in my books has been confirmed on the
                  bank statement&rdquo;. It matters for three reasons. First, the check below counts every entry that is not ticked as not yet cleared by the bank, so ticking is what makes the
                  balance in your books agree with the balance on the statement. Second, next time you reconcile, ticked entries are left out, so you only look at what is new. Third,
                  &ldquo;Done: save this reconciliation&rdquo; records the ticks as proof that the account was checked. Press the button once the green and yellow lines are right.
                </div>
              </details>
              {result.statementOnly.length > 0 && (
                <div className="note">
                  The red lines on the statement come to <strong>{statementOnlyNet >= 0 ? '+' : '-'}{fmt2(Math.abs(statementOnlyNet))}</strong>. After you tick the matches, that is the difference
                  you should still see below. Once they are recorded or matched, it should be nil.
                </div>
              )}
            </>
          )}
        </>
      )}
      {recording && <RecordFromStatement line={recording} bankAccountId={bankId} bankName={bankName} onClose={() => setRecording(null)} />}
      {editing && <EditEntryModal line={editing} onClose={() => setEditing(null)} onOpenScreen={() => void openEntry(editing)} />}
    </div>
  )
}
