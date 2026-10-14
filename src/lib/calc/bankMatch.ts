// Matches the lines of a bank statement to the lines of the books for the same
// bank account. A statement line and a ledger line are the same event when they
// are on the same side (money in or money out), for the same amount, and close
// in date. Each line is used once, nearest dates first.

import type { StatementLine } from '../import/bankStatement'
import type { BankLine } from './bankReconciliation'

export interface LedgerCandidate extends BankLine {
  /** Already ticked off against an earlier statement. */
  cleared: boolean
}

export interface StatementMatch {
  statement: StatementLine
  ledger: LedgerCandidate
  /** Days between the two dates (always 0 or more). */
  dayGap: number
  /** exact = same day, close = within 3 days, loose = further apart. */
  confidence: 'exact' | 'close' | 'loose'
  /** Another line could equally have been the partner (same amount, same gap). */
  ambiguous: boolean
  /** Paired by the user, not by the matcher. */
  forced?: boolean
}

/** A pairing chosen by hand: this statement line is that ledger line. */
export interface ForcedPair {
  statementRow: number
  ledgerId: string
}

export interface MatchResult {
  /** New matches: the ledger line is not ticked yet. */
  toTick: StatementMatch[]
  /** Matches with a ledger line that was ticked on an earlier visit. */
  alreadyTicked: StatementMatch[]
  /** On the statement, nothing like it in the books: a bank charge, interest, or an unrecorded entry. */
  statementOnly: StatementLine[]
  /** In the books during the statement period, not on the statement: probably not cleared yet. */
  booksOnly: LedgerCandidate[]
}

const DAY = 86400000
const dayNumber = (isoDate: string) => Math.round(Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) / DAY)
const cents = (n: number) => Math.round(n * 100)

export function matchStatement(
  lines: StatementLine[],
  ledger: LedgerCandidate[],
  opts: { days?: number; forced?: ForcedPair[] } = {}
): MatchResult {
  const days = opts.days ?? 7
  const usedStatement = new Set<number>()
  const usedLedger = new Set<string>()
  const result: MatchResult = { toTick: [], alreadyTicked: [], statementOnly: [], booksOnly: [] }

  const sideOf = (l: { deposit: number; withdrawal: number }) => (l.deposit > 0 ? 'in' : 'out')
  const amountOf = (l: { deposit: number; withdrawal: number }) => cents(l.deposit > 0 ? l.deposit : l.withdrawal)

  // Pairings chosen by hand come first, so the matcher works around them.
  for (const f of opts.forced ?? []) {
    const st = lines.find((x) => x.row === f.statementRow)
    const lg = ledger.find((x) => x.id === f.ledgerId)
    if (!st || !lg || usedStatement.has(st.row) || usedLedger.has(lg.id)) continue
    if (sideOf(st) !== sideOf(lg) || amountOf(st) !== amountOf(lg)) continue
    usedStatement.add(st.row)
    usedLedger.add(lg.id)
    const gap = Math.abs(dayNumber(st.date) - dayNumber(lg.date))
    const match: StatementMatch = { statement: st, ledger: lg, dayGap: gap, confidence: gap === 0 ? 'exact' : gap <= 3 ? 'close' : 'loose', ambiguous: false, forced: true }
    ;(lg.cleared ? result.alreadyTicked : result.toTick).push(match)
  }

  for (const pass of ['new', 'ticked'] as const) {
    const pool = ledger.filter((l) => (pass === 'new' ? !l.cleared : l.cleared) && !usedLedger.has(l.id))
    interface Candidate { s: StatementLine; l: LedgerCandidate; gap: number }
    const candidates: Candidate[] = []
    for (const s of lines) {
      if (usedStatement.has(s.row)) continue
      for (const l of pool) {
        if (sideOf(s) !== sideOf(l) || amountOf(s) !== amountOf(l)) continue
        const gap = Math.abs(dayNumber(s.date) - dayNumber(l.date))
        if (gap <= days) candidates.push({ s, l, gap })
      }
    }
    // How many partners each line could have had at its best gap, to flag a coin-toss.
    const bestGapOfStatement = new Map<number, number>()
    const bestGapOfLedger = new Map<string, number>()
    for (const c of candidates) {
      bestGapOfStatement.set(c.s.row, Math.min(bestGapOfStatement.get(c.s.row) ?? Infinity, c.gap))
      bestGapOfLedger.set(c.l.id, Math.min(bestGapOfLedger.get(c.l.id) ?? Infinity, c.gap))
    }
    const rivals = (c: Candidate) =>
      candidates.filter((o) => (o.s.row === c.s.row || o.l.id === c.l.id) && o.gap === c.gap).length > 1

    candidates.sort((a, b) => a.gap - b.gap || a.s.row - b.s.row || a.l.date.localeCompare(b.l.date))
    for (const c of candidates) {
      if (usedStatement.has(c.s.row) || usedLedger.has(c.l.id)) continue
      usedStatement.add(c.s.row)
      usedLedger.add(c.l.id)
      const match: StatementMatch = {
        statement: c.s,
        ledger: c.l,
        dayGap: c.gap,
        confidence: c.gap === 0 ? 'exact' : c.gap <= 3 ? 'close' : 'loose',
        ambiguous: rivals(c),
      }
      ;(pass === 'new' ? result.toTick : result.alreadyTicked).push(match)
    }
  }

  result.statementOnly = lines.filter((s) => !usedStatement.has(s.row))

  if (lines.length > 0) {
    const first = lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date)
    const last = lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date)
    const from = dayNumber(first) - days
    const to = dayNumber(last)
    result.booksOnly = ledger.filter((l) => !l.cleared && !usedLedger.has(l.id) && dayNumber(l.date) >= from && dayNumber(l.date) <= to)
  }
  return result
}
