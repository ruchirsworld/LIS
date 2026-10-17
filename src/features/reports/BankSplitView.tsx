import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { activateProps } from '../../lib/a11y'
import { ledgerKey, ledgerKeysOf, statementRowsOf, type LedgerCandidate, type MatchResult, type StatementMatch } from '../../lib/calc/bankMatch'
import type { StatementLine } from '../../lib/import/bankStatement'
import { canShowRecord } from './RecordDetailModal'
import './BankSplitView.css'

// green = matched one to one, or a group that has been saved (ticked); yellow = several lines matched with one on the
// other side (a group) that is not saved yet; red = no match; grey = in your books but outside this statement's dates.
type Status = 'match' | 'group' | 'only' | 'quiet'
type Side = 'bank' | 'books'

interface Row {
  key: string
  side: Side
  /** Statement row number, or the books entry's key. */
  ref: number | string
  date: string
  text: string
  detail?: string
  deposit: number
  withdrawal: number
  status: Status
  pairNo: number | null
  match: StatementMatch | null
  /** The books line, for the actions that need it. */
  line?: LedgerCandidate
}

const DAY = 86400000
const dayNo = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY)
const cents = (n: number) => Math.round(n * 100)
const amountOf = (r: { deposit: number; withdrawal: number }) => (r.deposit > 0 ? r.deposit : r.withdrawal)
const isIn = (r: { deposit: number }) => r.deposit > 0

const isGroup = (m: StatementMatch) => !!m.extra?.length || !!m.extraStatements?.length

/** Every entry in the books that the match covers has been ticked (saved). */
const isSaved = (m: StatementMatch) => [m.ledger, ...(m.extra ?? [])].every((l) => l.cleared)

function statusText(row: Row): string {
  const m = row.match
  if (!m) return row.status === 'only' ? (row.side === 'bank' ? 'Not in your books' : 'Not on the statement') : 'Outside this statement'
  const parts: string[] = []
  if (isGroup(m)) {
    const mine = row.side === 'bank' ? 1 + (m.extraStatements?.length ?? 0) : 1 + (m.extra?.length ?? 0)
    const other = row.side === 'bank' ? 1 + (m.extra?.length ?? 0) : 1 + (m.extraStatements?.length ?? 0)
    parts.push(mine > 1 ? `Group #${row.pairNo}: one of ${mine} that add up to the ${other > 1 ? `${other} on the other side` : 'one on the other side'}` : `Group #${row.pairNo}: the total of ${other} on the other side`)
  } else {
    parts.push(`Matched #${row.pairNo}`)
  }
  if (m.forced) parts.push('matched by you')
  else if (m.dayGap > 0) parts.push(`dates ${m.dayGap} day${m.dayGap === 1 ? '' : 's'} apart`)
  if (m.amountGap) parts.push(`amount differs by ₹${Math.abs(m.amountGap).toFixed(2)}, ignored`)
  if (m.ambiguous) parts.push(isGroup(m) ? 'check these belong together' : 'another entry has the same amount, check it')
  if (m.ledger.cleared) parts.push('ticked')
  return parts.join(' · ')
}

/** The bank statement on the left, the books on the right. Green lines are matched, yellow lines are groups (several lines
 * against one), red lines have no match. Tick the boxes on red lines on either side and press "Match these together". */
export function BankSplitView({
  lines,
  ledger,
  result,
  days,
  selectedBank,
  selectedBooks,
  onToggleBank,
  onToggleBooks,
  onClearSelection,
  onMatchSelected,
  onUnmatch,
  onRecord,
  onEdit,
  onView,
}: {
  lines: StatementLine[]
  ledger: LedgerCandidate[]
  result: MatchResult
  days: number
  /** Statement rows chosen for a hand match. */
  selectedBank: Set<number>
  /** Books entries (by key) chosen for a hand match. */
  selectedBooks: Set<string>
  onToggleBank: (row: number) => void
  onToggleBooks: (key: string) => void
  onClearSelection: () => void
  onMatchSelected: () => void
  /** Break a match that is wrong. */
  onUnmatch: (m: StatementMatch) => void
  /** Enter a statement line that is not in the books. */
  onRecord: (line: StatementLine) => void
  /** Change an entry in the books without leaving this screen. */
  onEdit: (line: LedgerCandidate) => void
  /** Look at every detail of an entry in the books, in a popup. */
  onView: (line: LedgerCandidate) => void
}) {
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [sel, setSel] = useState<{ side: Side; ref: number | string } | null>(null)

  const { bankRows, bookRows, partnerOf, counts } = useMemo(() => {
    const matches = [...result.toTick, ...result.alreadyTicked].sort(
      (a, b) => a.statement.date.localeCompare(b.statement.date) || a.statement.row - b.statement.row
    )
    const byStatement = new Map<number, { m: StatementMatch; no: number }>()
    const byLedger = new Map<string, { m: StatementMatch; no: number }>()
    matches.forEach((m, i) => {
      statementRowsOf(m).forEach((row) => byStatement.set(row, { m, no: i + 1 }))
      ledgerKeysOf(m).forEach((k) => byLedger.set(k, { m, no: i + 1 }))
    })
    // A group stays yellow until it is saved; once ticked it turns green like any other match.
    const statusOfMatch = (m: StatementMatch): Status => (isGroup(m) && !isSaved(m) ? 'group' : 'match')

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
        }
      })

    const first = lines.length ? lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date) : ''
    const last = lines.length ? lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date) : ''
    const booksOnly = new Set(result.booksOnly.map((l) => l.id))
    const books: Row[] = ledger
      .filter((l) => byLedger.has(ledgerKey(l)) || (first && dayNo(l.date) >= dayNo(first) - days && dayNo(l.date) <= dayNo(last)) || booksOnly.has(l.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((l) => {
        const hit = byLedger.get(ledgerKey(l))
        return {
          key: `books-${l.id}`,
          side: 'books' as const,
          ref: ledgerKey(l),
          date: l.date,
          text: l.description,
          detail: l.detail,
          deposit: l.deposit,
          withdrawal: l.withdrawal,
          status: hit ? statusOfMatch(hit.m) : booksOnly.has(l.id) ? 'only' : 'quiet',
          pairNo: hit?.no ?? null,
          match: hit?.m ?? null,
          line: l,
        }
      })

    // Everything on the other side that goes with this line (several for a group).
    const partner = (side: Side, ref: number | string): { side: Side; ref: number | string }[] => {
      if (side === 'bank') {
        const hit = byStatement.get(ref as number)
        return hit ? ledgerKeysOf(hit.m).map((k) => ({ side: 'books' as const, ref: k })) : []
      }
      const hit = byLedger.get(ref as string)
      return hit ? statementRowsOf(hit.m).map((row) => ({ side: 'bank' as const, ref: row })) : []
    }
    const tally = (rows: Row[]) => ({
      matched: new Set(rows.filter((r) => r.status === 'match').map((r) => r.pairNo)).size,
      groups: new Set(rows.filter((r) => r.status === 'group').map((r) => r.pairNo)).size,
      red: rows.filter((r) => r.status === 'only').length,
    })
    return { bankRows: bank, bookRows: books, partnerOf: partner, counts: { bank: tally(bank), books: tally(books) } }
  }, [lines, ledger, result, days])

  const partners = useMemo(() => (sel ? partnerOf(sel.side, sel.ref) : []), [sel, partnerOf])
  const domId = (side: Side, ref: number | string) => `sv-${side}-${String(ref).replace(/[^A-Za-z0-9_-]/g, '_')}`

  // Bring the matching rows on the other side into view when a row is chosen.
  useEffect(() => {
    if (partners[0]) document.getElementById(domId(partners[0].side, partners[0].ref))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (rows: Row[]) => (onlyProblems ? rows.filter((r) => r.status === 'only') : rows)

  // What has been chosen for a hand match, and whether it adds up.
  const chosenBank = bankRows.filter((r) => selectedBank.has(r.ref as number))
  const chosenBooks = bookRows.filter((r) => selectedBooks.has(r.ref as string))
  const bankTotal = chosenBank.reduce((s, r) => s + cents(amountOf(r)), 0)
  const booksTotal = chosenBooks.reduce((s, r) => s + cents(amountOf(r)), 0)
  const allRows = [...chosenBank, ...chosenBooks]
  const sameDirection = allRows.length > 0 && allRows.every((r) => isIn(r) === isIn(allRows[0]))
  const chosenCount = chosenBank.length + chosenBooks.length
  let matchProblem: string | null = null
  if (chosenCount === 0) matchProblem = null
  else if (chosenBank.length === 0 || chosenBooks.length === 0) matchProblem = 'Tick at least one line on each side.'
  else if (!sameDirection) matchProblem = 'Money in and money out cannot be matched together.'
  else if (bankTotal !== booksTotal) matchProblem = `The two sides differ by ${fmt2(Math.abs(bankTotal - booksTotal) / 100)}. They must add up to the same amount.`
  const canMatch = chosenCount > 0 && !matchProblem

  function renderRow(r: Row) {
    const isSel = !!sel && sel.side === r.side && sel.ref === r.ref
    const isPartner = partners.some((p) => p.side === r.side && p.ref === r.ref)
    const selectable = r.status === 'only' || r.status === 'quiet'
    const checked = r.side === 'bank' ? selectedBank.has(r.ref as number) : selectedBooks.has(r.ref as string)
    const bankLine = r.side === 'bank' ? lines.find((l) => l.row === r.ref) : undefined

    return (
      <div
        key={r.key}
        id={domId(r.side, r.ref)}
        className={`sv-row sv-${r.status}${isSel ? ' sv-selected' : ''}${isPartner ? ' sv-partner' : ''}${checked ? ' sv-checked' : ''}`}
        {...activateProps(() => setSel(isSel ? null : { side: r.side, ref: r.ref }))}
        aria-label={`${fmtDate(r.date)} ${r.text} ${statusText(r)}`}
      >
        <span className="sv-no">
          {selectable ? (
            <input
              type="checkbox"
              aria-label={`Select ${r.text || 'this line'} to match by hand`}
              checked={checked}
              onClick={(e) => e.stopPropagation()}
              onChange={() => (r.side === 'bank' ? onToggleBank(r.ref as number) : onToggleBooks(r.ref as string))}
            />
          ) : (
            r.pairNo ?? ''
          )}
        </span>
        <span className="sv-date">{fmtDate(r.date)}</span>
        <span className="sv-text">
          {r.text || '(no description)'}
          {r.detail && <small style={{ display: 'block', color: 'var(--ink)' }}>{r.detail}</small>}
          <small>{statusText(r)}</small>
        </span>
        <span className={`sv-amt ${isIn(r) ? 'sv-in' : 'sv-out'}`}>
          {isIn(r) ? '+' : '-'}
          {fmt2(amountOf(r))}
        </span>
        <span className="sv-actions">
          {r.status === 'only' && bankLine && (
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation()
                onRecord(bankLine)
              }}
            >
              Record this
            </button>
          )}
          {r.line?.sourceTable && r.line.sourceId && canShowRecord(r.line.sourceTable) && (
            <button
              type="button"
              className="btn secondary"
              onClick={(e) => {
                e.stopPropagation()
                onView(r.line as LedgerCandidate)
              }}
            >
              View
            </button>
          )}
          {r.line && (
            <button
              type="button"
              className="btn secondary"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(r.line as LedgerCandidate)
              }}
            >
              Edit
            </button>
          )}
          {r.match && (
            <button
              type="button"
              className="btn secondary"
              onClick={(e) => {
                e.stopPropagation()
                onUnmatch(r.match as StatementMatch)
              }}
            >
              Unmatch
            </button>
          )}
        </span>
      </div>
    )
  }

  const paneHead = (title: string, c: { matched: number; groups: number; red: number }) => (
    <header className="sv-head">
      <strong>{title}</strong>
      <span>
        {c.matched} matched{c.groups > 0 ? ` · ${c.groups} group${c.groups === 1 ? '' : 's'}` : ''} · <b className={c.red ? 'sv-bad' : ''}>{c.red} not matched</b>
      </span>
    </header>
  )

  return (
    <div className="sv">
      <div className="sv-legend" aria-label="Colour key">
        <span className="sv-chip sv-match">Green: matched</span>
        <span className="sv-chip sv-group">Yellow: several lines matched with one, not saved yet</span>
        <span className="sv-chip sv-only">Red: no match</span>
        <label className="sv-toggle">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only the red lines
        </label>
      </div>
      <div className="note" style={{ margin: '6px 0 10px' }}>
        Click a line to see what it is matched with. To match by hand, tick the boxes on red lines (several on one side are fine, for example three bank payments against one entry
        in your books), then press <strong>Match these together</strong>. A wrong match can be broken with <strong>Unmatch</strong>.
      </div>
      <div className="sv-grid">
        <section className="sv-pane" aria-label="Bank statement">
          {paneHead('Bank statement', counts.bank)}
          <div className="sv-list">{shown(bankRows).map(renderRow)}</div>
          {shown(bankRows).length === 0 && <div className="empty-row">Nothing to show.</div>}
        </section>
        <section className="sv-pane" aria-label="Your books">
          {paneHead('Your books', counts.books)}
          <div className="sv-list">{shown(bookRows).map(renderRow)}</div>
          {shown(bookRows).length === 0 && <div className="empty-row">Nothing to show.</div>}
        </section>
      </div>

      {chosenCount > 0 && (
        <div className="sv-matchbar" role="region" aria-label="Match by hand">
          <span>
            Bank: <b>{chosenBank.length}</b> line{chosenBank.length === 1 ? '' : 's'}, {fmt2(bankTotal / 100)} · Books: <b>{chosenBooks.length}</b> entr{chosenBooks.length === 1 ? 'y' : 'ies'}, {fmt2(booksTotal / 100)}
          </span>
          {matchProblem && <span className="sv-bad">{matchProblem}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button type="button" onClick={onMatchSelected} disabled={!canMatch}>
              Match these together
            </Button>
            <Button type="button" variant="secondary" onClick={onClearSelection}>
              Clear
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
