// The model behind the bank reconciliation screen: which books entries and statement lines are matched (saved), which are only suggested,
// and which have no match. Pure functions, so they are tested without a screen. Both sides use the bank statement's terms:
// "debit" is money out, "credit" is money in.

import { ledgerKey, matchStatement } from './bankMatch'

export { ledgerKey }
import type { StatementLine } from '../import/bankStatement'
import type { SavedMatch, StatementRecord } from '../queries/recon'

export interface BookEntry {
  id: string
  date: string
  description: string
  detail?: string
  /** Money in (a deposit). */
  deposit: number
  /** Money out (a payment). */
  withdrawal: number
  sourceTable?: string | null
  sourceId?: string | null
}

export interface BookRow extends BookEntry {
  /** What the books say the account holds after this entry. */
  balance: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Adds the running balance: the books' balance after each entry, oldest first. */
export function withRunningBalance(entries: BookEntry[]): BookRow[] {
  let balance = 0
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      balance = round2(balance + e.deposit - e.withdrawal)
      return { ...e, balance }
    })
}

/** The key under which a "reviewed" tick is kept. A books entry is named by the record it came from, because editing the record posts it again
 * with a new ledger line. */
export const bankKey = (id: string) => `bank:${id}`
export const bookKey = (e: { id: string; sourceTable?: string | null; sourceId?: string | null }) => (e.sourceTable && e.sourceId ? `book:${e.sourceTable}|${e.sourceId}` : `book:${e.id}`)
export const matchKey = (id: string) => `match:${id}`

export interface PairRow {
  kind: 'matched' | 'suggested'
  key: string
  matchId: string | null
  groupRef: string | null
  books: BookRow[]
  bank: StatementRecord[]
  /** The amount the two sides share. */
  total: number
  /** Statement total less books total (paise differences are ignored by the match rules). */
  difference: number
  direction: 'in' | 'out'
  /** Earliest date on either side, for ordering. */
  date: string
  /** A suggestion that has other candidates with the same amount, so it is worth a look. */
  ambiguous?: boolean
}

const amountOfBook = (b: { deposit: number; withdrawal: number }) => (b.deposit > 0 ? b.deposit : b.withdrawal)
const amountOfBank = (b: { debit: number; credit: number }) => (b.credit > 0 ? b.credit : b.debit)
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0))

export interface Partition {
  matched: PairRow[]
  booksOnly: BookRow[]
  bankOnly: StatementRecord[]
}

/** Splits the books and the statement into the saved matches and what is left. A match is kept whole even if some of its lines are outside
 * the date range, so a group never appears half-shown. */
export function partition(books: BookRow[], bank: StatementRecord[], matches: SavedMatch[]): Partition {
  const bookById = new Map(books.map((b) => [b.id, b]))
  const bankById = new Map(bank.map((b) => [b.id, b]))
  const usedBooks = new Set<string>()
  const usedBank = new Set<string>()
  const matched: PairRow[] = []
  for (const m of matches) {
    const bs = m.journalLineIds.map((id) => bookById.get(id)).filter((x): x is BookRow => !!x)
    const ks = m.bankLineIds.map((id) => bankById.get(id)).filter((x): x is StatementRecord => !!x)
    // A match with a side missing (its entry was edited, or the statement trimmed) is not shown as matched.
    if (bs.length === 0 || ks.length === 0 || bs.length !== m.journalLineIds.length || ks.length !== m.bankLineIds.length) continue
    bs.forEach((b) => usedBooks.add(b.id))
    ks.forEach((k) => usedBank.add(k.id))
    const booksTotal = sum(bs.map(amountOfBook))
    const bankTotal = sum(ks.map(amountOfBank))
    matched.push({
      kind: 'matched',
      key: matchKey(m.id),
      matchId: m.id,
      groupRef: m.group_ref,
      books: bs,
      bank: ks,
      total: bankTotal,
      difference: round2(bankTotal - booksTotal),
      direction: ks[0].credit > 0 ? 'in' : 'out',
      date: [...bs.map((b) => b.date), ...ks.map((k) => k.line_date)].sort()[0],
    })
  }
  matched.sort((a, b) => b.date.localeCompare(a.date))
  return {
    matched,
    booksOnly: books.filter((b) => !usedBooks.has(b.id)),
    bankOnly: bank.filter((k) => !usedBank.has(k.id)),
  }
}

/** Matches the engine proposes for the lines that have no saved match: same amount and side, near dates, and groups that add up exactly.
 * They are suggestions only; nothing is saved until the person confirms. */
export function suggest(
  booksOnly: BookRow[],
  bankOnly: StatementRecord[],
  opts: { days: number; forbidden: { bankLineId: string; ledgerKey: string }[] }
): { suggestions: PairRow[]; booksLeft: BookRow[]; bankLeft: StatementRecord[] } {
  const lines: StatementLine[] = bankOnly.map((k, i) => ({
    row: i,
    date: k.line_date,
    description: k.description,
    reference: k.reference,
    deposit: k.credit,
    withdrawal: k.debit,
    balance: k.balance,
  }))
  const forbidden = opts.forbidden.flatMap((f) => {
    const row = bankOnly.findIndex((k) => k.id === f.bankLineId)
    return row >= 0 ? [{ statementRow: row, ledgerId: f.ledgerKey }] : []
  })
  const result = matchStatement(
    lines,
    booksOnly.map((b) => ({ ...b, cleared: false })),
    { days: opts.days, forbidden }
  )
  const usedBooks = new Set<string>()
  const usedBank = new Set<string>()
  const suggestions: PairRow[] = []
  for (const m of [...result.toTick, ...result.alreadyTicked]) {
    const stRows = [m.statement, ...(m.extraStatements ?? [])]
    const lgs = [m.ledger, ...(m.extra ?? [])]
    const bs = lgs.map((l) => booksOnly.find((b) => b.id === l.id)).filter((x): x is BookRow => !!x)
    const ks = stRows.map((s) => bankOnly[s.row]).filter(Boolean)
    if (bs.length !== lgs.length || ks.length !== stRows.length) continue
    bs.forEach((b) => usedBooks.add(b.id))
    ks.forEach((k) => usedBank.add(k.id))
    const booksTotal = sum(bs.map(amountOfBook))
    const bankTotal = sum(ks.map(amountOfBank))
    suggestions.push({
      kind: 'suggested',
      key: `sugg:${ks.map((k) => k.id).join('+')}`,
      matchId: null,
      groupRef: null,
      books: bs,
      bank: ks,
      total: bankTotal,
      difference: round2(bankTotal - booksTotal),
      direction: ks[0].credit > 0 ? 'in' : 'out',
      date: [...bs.map((b) => b.date), ...ks.map((k) => k.line_date)].sort()[0],
      ambiguous: m.ambiguous,
    })
  }
  suggestions.sort((a, b) => b.date.localeCompare(a.date))
  return { suggestions, booksLeft: booksOnly.filter((b) => !usedBooks.has(b.id)), bankLeft: bankOnly.filter((k) => !usedBank.has(k.id)) }
}

export type ReconFilter = 'all' | 'unreviewed' | 'reviewed' | 'matched' | 'unmatched'

/** Whether a row belongs under a filter. A pair (matched or suggested) is "reviewed" when its own tick is set. */
export function passesFilter(filter: ReconFilter, row: { matched: boolean; reviewed: boolean }): boolean {
  switch (filter) {
    case 'reviewed':
      return row.reviewed
    case 'unreviewed':
      return !row.reviewed
    case 'matched':
      return row.matched
    case 'unmatched':
      return !row.matched
    default:
      return true
  }
}

/** The group total check: the two sides must add up to the same amount, within 99 paise. Returns a plain sentence when they do not. */
export function groupProblem(bankLines: StatementRecord[], bookLines: BookRow[]): string | null {
  if (bankLines.length === 0 || bookLines.length === 0) return 'Tick at least one line on each side.'
  const allIn = [...bankLines.map((b) => b.credit > 0), ...bookLines.map((b) => b.deposit > 0)]
  if (allIn.some((x) => x !== allIn[0])) return 'Money in and money out cannot be matched together.'
  const diff = round2(sum(bankLines.map(amountOfBank)) - sum(bookLines.map(amountOfBook)))
  if (Math.abs(diff) > 0.99) return `The two sides differ by ₹${Math.abs(diff).toFixed(2)}. They must add up to the same amount.`
  return null
}

export interface ReconSummary {
  matched: number
  groups: number
  suggested: number
  unmatchedBooks: number
  unmatchedBank: number
  /** Net of what is only on the statement, less what is only in the books (money in positive). It is what remains to explain. */
  difference: number
}

export function summarise(p: { matched: PairRow[]; suggested: PairRow[]; booksOnly: BookRow[]; bankOnly: StatementRecord[] }): ReconSummary {
  const net = (credit: number, debit: number) => credit - debit
  const bankNet = sum(p.bankOnly.map((k) => net(k.credit, k.debit)))
  const booksNet = sum(p.booksOnly.map((b) => net(b.deposit, b.withdrawal)))
  return {
    matched: p.matched.length,
    groups: p.matched.filter((m) => m.groupRef).length,
    suggested: p.suggested.length,
    unmatchedBooks: p.booksOnly.length,
    unmatchedBank: p.bankOnly.length,
    difference: round2(bankNet - booksNet),
  }
}
