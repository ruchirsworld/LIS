import { useEffect, useMemo, useState } from 'react'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { activateProps } from '../../lib/a11y'
import { ledgerIdsOf, statementRowsOf, type LedgerCandidate, type MatchResult, type StatementMatch } from '../../lib/calc/bankMatch'
import type { StatementLine } from '../../lib/import/bankStatement'
import './BankSplitView.css'

type Status = 'match' | 'check' | 'ticked' | 'only' | 'quiet'
type Side = 'bank' | 'books'

interface Row {
  key: string
  side: Side
  /** Statement row number, or ledger line id. */
  ref: number | string
  date: string
  text: string
  /** What the person typed on a books entry. */
  detail?: string
  deposit: number
  withdrawal: number
  status: Status
  pairNo: number | null
  match: StatementMatch | null
  selectableForTick: boolean
}

const DAY = 86400000
const dayNo = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY)
const amountOf = (r: { deposit: number; withdrawal: number }) => Math.round((r.deposit > 0 ? r.deposit : r.withdrawal) * 100)
const isIn = (r: { deposit: number }) => r.deposit > 0

const LABEL: Record<Side, Record<Exclude<Status, 'match' | 'check' | 'ticked'>, string>> = {
  bank: { only: 'Not in your books', quiet: '' },
  books: { only: 'Not on the statement', quiet: 'Not on this statement' },
}

/** When one line on a side is the total of several on the other, say so. */
function groupNote(row: Row): string {
  const m = row.match
  if (!m) return ''
  if (row.side === 'bank' && m.extra?.length) return `, the total of ${m.extra.length + 1} entries in your books`
  if (row.side === 'books' && m.extraStatements?.length) return `, the total of ${m.extraStatements.length + 1} statement lines`
  if (row.side === 'bank' && m.extraStatements?.length) return `, one of ${m.extraStatements.length + 1} statement lines`
  if (row.side === 'books' && m.extra?.length) return `, one of ${m.extra.length + 1} entries`
  return ''
}

function statusText(row: Row): string {
  if (row.status === 'match') return `Matches #${row.pairNo}${row.match?.forced ? ' (paired by you)' : ''}${groupNote(row)}`
  if (row.status === 'check') return `Matches #${row.pairNo}${groupNote(row)}, check it`
  if (row.status === 'ticked') return `Matches #${row.pairNo}${groupNote(row)}, already ticked`
  return LABEL[row.side][row.status]
}

/** The bank statement on the left, the books on the right: matched pairs share a colour and number,
 * and the lines in question stand out on each side. */
export function BankSplitView({
  lines,
  ledger,
  result,
  days,
  picked,
  onPick,
  onForce,
  onUnforce,
  onRecord,
  onOpen,
  onChangeMatch,
  onUnmatch,
}: {
  lines: StatementLine[]
  ledger: LedgerCandidate[]
  result: MatchResult
  days: number
  picked: Set<string>
  onPick: (ledgerId: string, on: boolean) => void
  onForce: (statementRow: number, ledgerId: string) => void
  onUnforce: (statementRow: number) => void
  /** Enter a statement line that is not in the books. */
  onRecord?: (line: StatementLine) => void
  /** Go to the screen that holds a line in the books. */
  onOpen?: (line: LedgerCandidate) => void
  /** Choose a different entry for a matched line. */
  onChangeMatch?: (m: StatementMatch) => void
  /** Break a match that is wrong. */
  onUnmatch?: (m: StatementMatch) => void
}) {
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [sel, setSel] = useState<{ side: Side; ref: number | string } | null>(null)

  const { bankRows, bookRows, partnerOf } = useMemo(() => {
    const matches = [...result.toTick, ...result.alreadyTicked].sort(
      (a, b) => a.statement.date.localeCompare(b.statement.date) || a.statement.row - b.statement.row
    )
    const byStatement = new Map<number, { m: StatementMatch; no: number }>()
    const byLedger = new Map<string, { m: StatementMatch; no: number }>()
    matches.forEach((m, i) => {
      statementRowsOf(m).forEach((row) => byStatement.set(row, { m, no: i + 1 }))
      ledgerIdsOf(m).forEach((id) => byLedger.set(id, { m, no: i + 1 }))
    })
    const statusOfMatch = (m: StatementMatch): Status => (m.ledger.cleared ? 'ticked' : m.ambiguous || m.confidence === 'loose' ? 'check' : 'match')

    const bank: Row[] = [...lines]
      .sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)
      .map((l) => {
        const hit = byStatement.get(l.row)
        return {
          key: `bank-${l.row}`,
          side: 'bank' as const,
          ref: l.row,
          date: l.date,
          text: l.description || l.reference,
          deposit: l.deposit,
          withdrawal: l.withdrawal,
          status: hit ? statusOfMatch(hit.m) : 'only',
          pairNo: hit?.no ?? null,
          match: hit?.m ?? null,
          selectableForTick: false,
        }
      })

    const first = lines.length ? lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date) : ''
    const last = lines.length ? lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date) : ''
    const booksOnly = new Set(result.booksOnly.map((l) => l.id))
    const books: Row[] = ledger
      .filter((l) => byLedger.has(l.id) || (first && dayNo(l.date) >= dayNo(first) - days && dayNo(l.date) <= dayNo(last)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((l) => {
        const hit = byLedger.get(l.id)
        return {
          key: `books-${l.id}`,
          side: 'books' as const,
          ref: l.id,
          date: l.date,
          text: l.description,
          detail: l.detail,
          deposit: l.deposit,
          withdrawal: l.withdrawal,
          status: hit ? statusOfMatch(hit.m) : booksOnly.has(l.id) ? 'only' : 'quiet',
          pairNo: hit?.no ?? null,
          match: hit?.m ?? null,
          // One tick covers every entry of a lump-sum match, so only its first entry has the box.
          selectableForTick: !!hit && !hit.m.ledger.cleared && hit.m.ledger.id === l.id,
        }
      })

    // Everything on the other side that goes with this line (several for a lump-sum match).
    const partner = (side: Side, ref: number | string): { side: Side; ref: number | string }[] => {
      if (side === 'bank') {
        const hit = byStatement.get(ref as number)
        return hit ? ledgerIdsOf(hit.m).map((id) => ({ side: 'books' as const, ref: id })) : []
      }
      const hit = byLedger.get(ref as string)
      return hit ? statementRowsOf(hit.m).map((row) => ({ side: 'bank' as const, ref: row })) : []
    }
    return { bankRows: bank, bookRows: books, partnerOf: partner }
  }, [lines, ledger, result, days])

  const partners = useMemo(() => (sel ? partnerOf(sel.side, sel.ref) : []), [sel, partnerOf])
  const domId = (side: Side, ref: number | string) => `sv-${side}-${ref}`

  // Bring the matching row on the other side into view when a row is chosen.
  useEffect(() => {
    if (partners[0]) document.getElementById(domId(partners[0].side, partners[0].ref))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRow = sel ? [...bankRows, ...bookRows].find((r) => r.side === sel.side && r.ref === sel.ref) ?? null : null
  const problem = (r: Row) => r.status === 'only' || r.status === 'check'
  const shown = (rows: Row[]) => (onlyProblems ? rows.filter(problem) : rows)
  const counts = (rows: Row[]) => ({ ok: rows.filter((r) => r.status === 'match' || r.status === 'ticked').length, bad: rows.filter(problem).length })
  const bankCount = counts(bankRows)
  const bookCount = counts(bookRows)

  function renderRow(r: Row) {
    const isSel = !!sel && sel.side === r.side && sel.ref === r.ref
    const isPartner = partners.some((p) => p.side === r.side && p.ref === r.ref)
    // The other side's rows with the same amount and direction can be paired with the chosen row.
    const canPair =
      !!selectedRow &&
      selectedRow.side !== r.side &&
      isIn(selectedRow) === isIn(r) &&
      amountOf(selectedRow) === amountOf(r) &&
      !isPartner &&
      !r.match?.extra?.length &&
      !r.match?.extraStatements?.length &&
      !selectedRow.match?.extra?.length &&
      !selectedRow.match?.extraStatements?.length
    const showRecord = r.side === 'bank' && r.status === 'only' && !!onRecord
    const bookLine = r.side === 'books' ? ledger.find((l) => l.id === r.ref) : undefined
    const showOpen = !!onOpen && !!bookLine?.sourceTable
    const statementRow = r.side === 'bank' ? (r.ref as number) : selectedRow?.side === 'bank' ? (selectedRow.ref as number) : null
    const ledgerId = r.side === 'books' ? (r.ref as string) : selectedRow?.side === 'books' ? (selectedRow.ref as string) : null

    return (
      <div
        key={r.key}
        id={domId(r.side, r.ref)}
        className={`sv-row sv-${r.status}${isSel ? ' sv-selected' : ''}${isPartner ? ' sv-partner' : ''}`}
        {...activateProps(() => setSel(isSel ? null : { side: r.side, ref: r.ref }))}
        aria-label={`${fmtDate(r.date)} ${r.text} ${statusText(r)}`}
      >
        <span className="sv-no">
          {r.selectableForTick ? (
            <input
              type="checkbox"
              aria-label={`Tick ${r.text}`}
              checked={picked.has(r.ref as string)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onPick(r.ref as string, e.target.checked)}
            />
          ) : (
            r.pairNo ?? ''
          )}
        </span>
        <span className="sv-date">{fmtDate(r.date)}</span>
        <span className="sv-text">
          {r.text || '(no description)'}
          {r.detail && <small style={{ display: 'block', color: 'var(--ink)' }}>{r.detail}</small>}
          <small>
            {r.selectableForTick && r.pairNo ? `#${r.pairNo} · ` : ''}
            {statusText(r)}
          </small>
        </span>
        <span className={`sv-amt ${isIn(r) ? 'sv-in' : 'sv-out'}`}>
          {isIn(r) ? '+' : '-'}
          {fmt2(isIn(r) ? r.deposit : r.withdrawal)}
        </span>
        {(canPair || r.match || showRecord || showOpen) && (
          <span className="sv-actions">
            {showRecord && (
              <button
                type="button"
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRecord?.(lines.find((l) => l.row === r.ref) as StatementLine)
                }}
              >
                Record this
              </button>
            )}
            {showOpen && bookLine && (
              <button
                type="button"
                className="btn secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen?.(bookLine)
                }}
              >
                Open this entry
              </button>
            )}
            {canPair && statementRow !== null && ledgerId !== null && (
              <button
                type="button"
                className="btn secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  onForce(statementRow, ledgerId)
                  setSel(null)
                }}
              >
                Pair with selected
              </button>
            )}
            {r.match && onChangeMatch && !r.match.extra?.length && !r.match.extraStatements?.length && (
              <button
                type="button"
                className="btn secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  onChangeMatch(r.match!)
                }}
              >
                Change match
              </button>
            )}
            {r.match && onUnmatch && (
              <button
                type="button"
                className="btn secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnmatch(r.match!)
                }}
              >
                Unmatch
              </button>
            )}
            {r.match?.forced && (
              <button
                type="button"
                className="btn secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnforce(r.match!.statement.row)
                }}
              >
                Undo my pairing
              </button>
            )}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="sv">
      <div className="sv-legend" aria-label="Colour key">
        <span className="sv-chip sv-match">Matched</span>
        <span className="sv-chip sv-check">Matched, check it</span>
        <span className="sv-chip sv-only">Needs attention: only on one side</span>
        <span className="sv-chip sv-ticked">Already ticked</span>
        <label className="sv-toggle">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only the lines in question
        </label>
      </div>
      <div className="note" style={{ margin: '6px 0 10px' }}>
        Click a line to see its partner on the other side. If two lines have the same amount and the app paired the wrong ones, click the line that is right, then
        press <strong>Pair with selected</strong> on its partner. Pairings you make here only last until you leave this page. What is saved is the tick.
      </div>
      <div className="sv-grid">
        <section className="sv-pane" aria-label="Bank statement">
          <header className="sv-head">
            <strong>Bank statement</strong>
            <span>
              {bankCount.ok} matched · <b className={bankCount.bad ? 'sv-bad' : ''}>{bankCount.bad} in question</b>
            </span>
          </header>
          <div className="sv-list">{shown(bankRows).map(renderRow)}</div>
          {shown(bankRows).length === 0 && <div className="empty-row">Nothing to show.</div>}
        </section>
        <section className="sv-pane" aria-label="Your books">
          <header className="sv-head">
            <strong>Your books</strong>
            <span>
              {bookCount.ok} matched · <b className={bookCount.bad ? 'sv-bad' : ''}>{bookCount.bad} in question</b>
            </span>
          </header>
          <div className="sv-list">{shown(bookRows).map(renderRow)}</div>
          {shown(bookRows).length === 0 && <div className="empty-row">Nothing to show.</div>}
        </section>
      </div>
    </div>
  )
}
