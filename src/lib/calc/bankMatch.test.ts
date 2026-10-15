import { describe, expect, it } from 'vitest'
import { ledgerIdsOf, ledgerTotalOf, matchStatement, statementRowsOf, type LedgerCandidate } from './bankMatch'
import type { StatementLine } from '../import/bankStatement'

const s = (row: number, date: string, deposit: number, withdrawal: number, description = ''): StatementLine => ({
  row,
  date,
  description,
  reference: '',
  deposit,
  withdrawal,
  balance: null,
})
const l = (id: string, date: string, deposit: number, withdrawal: number, cleared = false): LedgerCandidate => ({
  id,
  date,
  description: id,
  deposit,
  withdrawal,
  cleared,
})

describe('matching a bank statement to the books', () => {
  it('matches the same side, amount and a nearby date', () => {
    const r = matchStatement([s(1, '2026-10-05', 300000, 0), s(2, '2026-10-08', 0, 118000)], [l('rec', '2026-10-04', 300000, 0), l('pay', '2026-10-05', 0, 118000)])
    expect(r.toTick.map((m) => [m.statement.row, m.ledger.id])).toEqual(expect.arrayContaining([[1, 'rec'], [2, 'pay']]))
    expect(r.toTick.find((m) => m.ledger.id === 'rec')?.confidence).toBe('close')
    expect(r.statementOnly).toHaveLength(0)
    expect(r.booksOnly).toHaveLength(0)
  })

  it('never matches money in with money out of the same amount', () => {
    const r = matchStatement([s(1, '2026-10-05', 1000, 0)], [l('x', '2026-10-05', 0, 1000)])
    expect(r.toTick).toHaveLength(0)
    expect(r.statementOnly).toHaveLength(1)
    expect(r.booksOnly).toHaveLength(1)
  })

  it('does not match dates further apart than the window', () => {
    const r = matchStatement([s(1, '2026-10-30', 500, 0)], [l('x', '2026-10-05', 500, 0)], { days: 7 })
    expect(r.toTick).toHaveLength(0)
  })

  it('uses each line once and pairs the nearest dates first', () => {
    const r = matchStatement(
      [s(1, '2026-10-05', 500, 0), s(2, '2026-10-20', 500, 0)],
      [l('early', '2026-10-05', 500, 0), l('late', '2026-10-20', 500, 0)]
    )
    expect(r.toTick.find((m) => m.statement.row === 1)?.ledger.id).toBe('early')
    expect(r.toTick.find((m) => m.statement.row === 2)?.ledger.id).toBe('late')
  })

  it('flags a match as ambiguous when two lines could equally be the partner', () => {
    const r = matchStatement([s(1, '2026-10-05', 500, 0)], [l('a', '2026-10-05', 500, 0), l('b', '2026-10-05', 500, 0)])
    expect(r.toTick).toHaveLength(1)
    expect(r.toTick[0].ambiguous).toBe(true)
    expect(r.booksOnly).toHaveLength(1)
  })

  it('recognises lines ticked on an earlier visit instead of calling them missing', () => {
    const r = matchStatement([s(1, '2026-10-05', 500, 0), s(2, '2026-10-06', 700, 0)], [l('done', '2026-10-05', 500, 0, true), l('new', '2026-10-06', 700, 0)])
    expect(r.alreadyTicked.map((m) => m.ledger.id)).toEqual(['done'])
    expect(r.toTick.map((m) => m.ledger.id)).toEqual(['new'])
    expect(r.statementOnly).toHaveLength(0)
  })

  it('lists statement-only lines (bank charges) and books-only lines (uncleared cheques)', () => {
    const r = matchStatement(
      [s(1, '2026-10-05', 0, 118, 'BANK CHARGES'), s(2, '2026-10-06', 400, 0)],
      [l('cheque', '2026-10-04', 0, 9000), l('rec', '2026-10-06', 400, 0), l('later', '2026-12-30', 0, 5)]
    )
    expect(r.statementOnly.map((x) => x.description)).toEqual(['BANK CHARGES'])
    expect(r.booksOnly.map((x) => x.id)).toEqual(['cheque'])
  })

  it('handles an empty statement', () => {
    const r = matchStatement([], [l('x', '2026-10-05', 1, 0)])
    expect(r.toTick).toHaveLength(0)
    expect(r.booksOnly).toHaveLength(0)
  })

  it('honours a pairing chosen by hand and works around it', () => {
    // Two 10,000 payments on the statement, one 10,000 entry in the books. The matcher
    // would pick row 1; the user says it is row 2.
    const stmt = [s(1, '2026-10-08', 0, 10000, 'NEFT Moin'), s(2, '2026-10-08', 0, 10000, 'NEFT Laavin')]
    const books = [l('trf', '2026-10-08', 0, 10000)]
    const auto = matchStatement(stmt, books)
    expect(auto.toTick[0].statement.row).toBe(1)
    const hand = matchStatement(stmt, books, { forced: [{ statementRow: 2, ledgerId: 'trf' }] })
    expect(hand.toTick).toHaveLength(1)
    expect(hand.toTick[0].statement.row).toBe(2)
    expect(hand.toTick[0].forced).toBe(true)
    expect(hand.statementOnly.map((x) => x.row)).toEqual([1])
  })

  it('ignores a hand pairing whose amounts or sides differ', () => {
    const r = matchStatement([s(1, '2026-10-08', 0, 10000)], [l('x', '2026-10-08', 0, 9000)], { forced: [{ statementRow: 1, ledgerId: 'x' }] })
    expect(r.toTick).toHaveLength(0)
  })

  it('matches one transfer to the several entries it settled', () => {
    // A traveller repaid 1,200 + 300 + 500 = 2,000 in one transfer; each expense is its own entry in the books.
    const settled = (id: string, amount: number): LedgerCandidate => ({ ...l(id, '2026-10-12', 0, amount), sourceTable: 'expense_reimbursements' })
    const r = matchStatement([s(1, '2026-10-12', 0, 2000, 'NEFT TRAVELLER')], [settled('r1', 1200), settled('r2', 300), settled('r3', 500), l('other', '2026-10-12', 0, 777)])
    expect(r.toTick).toHaveLength(1)
    expect(ledgerIdsOf(r.toTick[0]).sort()).toEqual(['r1', 'r2', 'r3'])
    expect(ledgerTotalOf(r.toTick[0])).toBe(2000)
    expect(r.toTick[0].ambiguous).toBe(false)
    expect(r.statementOnly).toHaveLength(0)
    expect(r.booksOnly.map((x) => x.id)).toEqual(['other'])
  })

  it('finds a combination that adds up, and flags it for a look', () => {
    const r = matchStatement(
      [s(1, '2026-10-12', 0, 1500)],
      [l('a', '2026-10-10', 0, 1000), l('b', '2026-10-11', 0, 500), l('c', '2026-10-12', 0, 4000)]
    )
    expect(r.toTick).toHaveLength(1)
    expect(ledgerIdsOf(r.toTick[0]).sort()).toEqual(['a', 'b'])
    expect(r.toTick[0].ambiguous).toBe(true)
  })

  it('does not group entries that do not add up, or mix ticked and new ones', () => {
    expect(matchStatement([s(1, '2026-10-12', 0, 1600)], [l('a', '2026-10-12', 0, 1000), l('b', '2026-10-12', 0, 500)]).toTick).toHaveLength(0)
    const mixed = matchStatement([s(1, '2026-10-12', 0, 1500)], [l('a', '2026-10-12', 0, 1000, true), l('b', '2026-10-12', 0, 500)])
    expect(mixed.toTick).toHaveLength(0)
    expect(mixed.alreadyTicked).toHaveLength(0)
  })

  it('recognises a lump-sum match ticked on an earlier visit', () => {
    const r = matchStatement([s(1, '2026-10-12', 0, 1500)], [l('a', '2026-10-12', 0, 1000, true), l('b', '2026-10-12', 0, 500, true)])
    expect(r.alreadyTicked).toHaveLength(1)
    expect(ledgerIdsOf(r.alreadyTicked[0]).sort()).toEqual(['a', 'b'])
  })

  it('still prefers a single entry of the same amount over a combination', () => {
    const r = matchStatement([s(1, '2026-10-12', 0, 1500)], [l('whole', '2026-10-12', 0, 1500), l('a', '2026-10-12', 0, 1000), l('b', '2026-10-12', 0, 500)])
    expect(r.toTick[0].ledger.id).toBe('whole')
    expect(r.toTick[0].extra).toBeUndefined()
  })

  it('matches several statement lines to the one entry the books hold for them', () => {
    // Paid to a contractor in three instalments on one day; the books have the whole 5,000 as one entry.
    const r = matchStatement(
      [s(1, '2026-10-12', 0, 2000), s(2, '2026-10-12', 0, 2000), s(3, '2026-10-12', 0, 1000), s(4, '2026-10-14', 0, 99)],
      [l('whole', '2026-10-12', 0, 5000)]
    )
    expect(r.toTick).toHaveLength(1)
    expect(r.toTick[0].ledger.id).toBe('whole')
    expect(statementRowsOf(r.toTick[0]).sort()).toEqual([1, 2, 3])
    expect(r.toTick[0].ambiguous).toBe(false)
    expect(r.statementOnly.map((x) => x.row)).toEqual([4])
    expect(r.booksOnly).toHaveLength(0)
  })

  it('flags statement lines on different days that add up to one entry', () => {
    const r = matchStatement([s(1, '2026-10-10', 0, 3000), s(2, '2026-10-13', 0, 2000)], [l('whole', '2026-10-12', 0, 5000)])
    expect(r.toTick).toHaveLength(1)
    expect(statementRowsOf(r.toTick[0]).sort()).toEqual([1, 2])
    expect(r.toTick[0].ambiguous).toBe(true)
  })

  it('never joins a pair the user unmatched, and uses another entry instead', () => {
    const stmt = [s(1, '2026-10-12', 0, 500)]
    const books = [l('a', '2026-10-12', 0, 500), l('b', '2026-10-13', 0, 500)]
    const r = matchStatement(stmt, books, { forbidden: [{ statementRow: 1, ledgerId: 'a' }] })
    expect(r.toTick).toHaveLength(1)
    expect(r.toTick[0].ledger.id).toBe('b')
    expect(r.booksOnly.map((x) => x.id)).toEqual(['a'])
  })

  it('leaves both sides unmatched when the only partner was unmatched', () => {
    const r = matchStatement([s(1, '2026-10-12', 0, 500)], [l('a', '2026-10-12', 0, 500)], { forbidden: [{ statementRow: 1, ledgerId: 'a' }] })
    expect(r.toTick).toHaveLength(0)
    expect(r.statementOnly.map((x) => x.row)).toEqual([1])
    expect(r.booksOnly.map((x) => x.id)).toEqual(['a'])
  })

  it('does not rebuild a lump-sum match that was unmatched', () => {
    const stmt = [s(1, '2026-10-12', 0, 1500)]
    const books = [l('a', '2026-10-12', 0, 1000), l('b', '2026-10-12', 0, 500)]
    expect(matchStatement(stmt, books).toTick).toHaveLength(1)
    const r = matchStatement(stmt, books, { forbidden: [{ statementRow: 1, ledgerId: 'a' }] })
    expect(r.toTick).toHaveLength(0)
  })
})
