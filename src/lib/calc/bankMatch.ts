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
  /** When one statement line is the total of several entries in the books (a lump-sum payment
   * that settled several bills or expenses), the other entries; `ledger` is then the first. */
  extra?: LedgerCandidate[]
  /** The reverse: the books hold one entry for what the bank shows as several payments; the other
   * statement lines, with `statement` being the first. */
  extraStatements?: StatementLine[]
}

/** Every statement line a match covers: one normally, several when the books record them as one entry. */
export function statementRowsOf(m: StatementMatch): number[] {
  return [m.statement.row, ...(m.extraStatements ?? []).map((s) => s.row)]
}

/** Every ledger line a match covers: one normally, several for a lump-sum match. */
export function ledgerIdsOf(m: StatementMatch): string[] {
  return [m.ledger.id, ...(m.extra ?? []).map((l) => l.id)]
}

/** The total of the ledger lines a match covers, on the side of the statement line. */
export function ledgerTotalOf(m: StatementMatch): number {
  const all = [m.ledger, ...(m.extra ?? [])]
  return Math.round(all.reduce((s, l) => s + (l.deposit > 0 ? l.deposit : l.withdrawal), 0) * 100) / 100
}

/** The entries that add up to the target, by DFS with pruning. Null when none do (or the search is too big). */
function findSubset(items: { id: string; c: number }[], target: number): string[] | null {
  const sorted = [...items].sort((a, b) => b.c - a.c)
  const suffix: number[] = new Array(sorted.length + 1).fill(0)
  for (let i = sorted.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sorted[i].c
  let budget = 150000
  const chosen: string[] = []
  const dfs = (i: number, remaining: number): boolean => {
    if (remaining === 0) return chosen.length >= 2
    if (i >= sorted.length || remaining < 0 || suffix[i] < remaining || budget-- <= 0) return false
    chosen.push(sorted[i].id)
    if (dfs(i + 1, remaining - sorted[i].c)) return true
    chosen.pop()
    return dfs(i + 1, remaining)
  }
  return dfs(0, target) ? [...chosen] : null
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
  opts: { days?: number; forced?: ForcedPair[]; forbidden?: ForcedPair[] } = {}
): MatchResult {
  const days = opts.days ?? 7
  // Pairs the user said are NOT the same event (an unmatch): the matcher never joins these again.
  const bad = new Set((opts.forbidden ?? []).map((f) => `${f.statementRow}|${f.ledgerId}`))
  const isBad = (row: number, ledgerId: string) => bad.has(`${row}|${ledgerId}`)
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
        if (sideOf(s) !== sideOf(l) || amountOf(s) !== amountOf(l) || isBad(s.row, l.id)) continue
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

  // A statement line that is the total of several entries: one transfer that settled a number of
  // bills or expenses, each recorded as its own entry. First entries recorded on one day by one
  // screen (a settlement), which is a confident match; then any combination that adds up (flagged).
  for (const pass of ['new', 'ticked'] as const) {
    for (const s of lines) {
      if (usedStatement.has(s.row)) continue
      const target = amountOf(s)
      const pool = ledger.filter(
        (l) => (pass === 'new' ? !l.cleared : l.cleared) && !usedLedger.has(l.id) && sideOf(l) === sideOf(s) && Math.abs(dayNumber(l.date) - dayNumber(s.date)) <= days
      )
      if (pool.length < 2) continue

      let picked: LedgerCandidate[] | null = null
      let ambiguous = false
      const byDay = new Map<string, LedgerCandidate[]>()
      for (const l of pool) {
        const key = `${l.date}|${l.sourceTable ?? ''}`
        byDay.set(key, [...(byDay.get(key) ?? []), l])
      }
      for (const group of byDay.values()) {
        if (group.length >= 2 && group.reduce((t, l) => t + amountOf(l), 0) === target && !group.some((l) => isBad(s.row, l.id))) {
          picked = group
          break
        }
      }
      if (!picked && pool.length <= 25) {
        const ids = findSubset(pool.map((l) => ({ id: l.id, c: amountOf(l) })), target)
        const found = ids ? pool.filter((l) => ids.includes(l.id)) : null
        if (found && !found.some((l) => isBad(s.row, l.id))) {
          picked = found
          ambiguous = true
        }
      }
      if (!picked) continue

      picked.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      const gap = Math.min(...picked.map((l) => Math.abs(dayNumber(l.date) - dayNumber(s.date))))
      usedStatement.add(s.row)
      picked.forEach((l) => usedLedger.add(l.id))
      const match: StatementMatch = {
        statement: s,
        ledger: picked[0],
        extra: picked.slice(1),
        dayGap: gap,
        confidence: gap === 0 ? 'exact' : gap <= 3 ? 'close' : 'loose',
        ambiguous,
      }
      ;(pass === 'new' ? result.toTick : result.alreadyTicked).push(match)
    }
  }

  // The reverse: an entry in the books that the bank shows as several payments (a cost entered once
  // that was paid in instalments, or a receipt entered as one that came in parts). Several statement
  // lines on one day that add up is a confident match; any other combination is flagged.
  for (const pass of ['new', 'ticked'] as const) {
    for (const l of ledger) {
      if ((pass === 'new') === l.cleared || usedLedger.has(l.id)) continue
      const target = amountOf(l)
      const pool = lines.filter((s) => !usedStatement.has(s.row) && sideOf(s) === sideOf(l) && Math.abs(dayNumber(l.date) - dayNumber(s.date)) <= days)
      if (pool.length < 2) continue

      let picked: StatementLine[] | null = null
      let ambiguous = false
      const byDay = new Map<string, StatementLine[]>()
      for (const s of pool) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s])
      for (const group of byDay.values()) {
        if (group.length >= 2 && group.reduce((t, s) => t + amountOf(s), 0) === target && !group.some((s) => isBad(s.row, l.id))) {
          picked = group
          break
        }
      }
      if (!picked && pool.length <= 25) {
        const rows = findSubset(pool.map((s) => ({ id: String(s.row), c: amountOf(s) })), target)
        const found = rows ? pool.filter((s) => rows.includes(String(s.row))) : null
        if (found && !found.some((s) => isBad(s.row, l.id))) {
          picked = found
          ambiguous = true
        }
      }
      if (!picked) continue

      picked.sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)
      const gap = Math.min(...picked.map((s) => Math.abs(dayNumber(l.date) - dayNumber(s.date))))
      picked.forEach((s) => usedStatement.add(s.row))
      usedLedger.add(l.id)
      const match: StatementMatch = {
        statement: picked[0],
        extraStatements: picked.slice(1),
        ledger: l,
        dayGap: gap,
        confidence: gap === 0 ? 'exact' : gap <= 3 ? 'close' : 'loose',
        ambiguous,
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
