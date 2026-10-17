import { describe, expect, it } from 'vitest'
import { groupProblem, ledgerKey, partition, passesFilter, suggest, summarise, withRunningBalance, type BookEntry } from './reconView'
import type { SavedMatch, StatementRecord } from '../queries/recon'

const book = (id: string, date: string, deposit: number, withdrawal: number): BookEntry => ({ id, date, description: `entry ${id}`, deposit, withdrawal })
const bank = (id: string, date: string, credit: number, debit: number): StatementRecord => ({
  id, bank_account_id: 'b', line_date: date, description: `line ${id}`, reference: '', debit, credit, balance: null, source_file: null,
})
const saved = (id: string, bankIds: string[], journalIds: string[], ref: string | null = null): SavedMatch => ({
  id, group_ref: ref, kind: 'manual', matched_total: 0, difference: 0, cleared_on: '2026-10-01', created_at: '', bankLineIds: bankIds, journalLineIds: journalIds,
})

describe('withRunningBalance', () => {
  it('adds money in and takes off money out, oldest first', () => {
    const rows = withRunningBalance([book('b', '2026-10-02', 0, 30), book('a', '2026-10-01', 100, 0)])
    expect(rows.map((r) => r.balance)).toEqual([100, 70])
  })
})

describe('partition', () => {
  it('shows saved matches as pairs and leaves the rest', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 500, 0), book('j2', '2026-10-02', 0, 70)])
    const lines = [bank('s1', '2026-10-01', 500, 0), bank('s2', '2026-10-03', 0, 99)]
    const p = partition(books, lines, [saved('m1', ['s1'], ['j1'])])
    expect(p.matched).toHaveLength(1)
    expect(p.matched[0].direction).toBe('in')
    expect(p.booksOnly.map((b) => b.id)).toEqual(['j2'])
    expect(p.bankOnly.map((b) => b.id)).toEqual(['s2'])
  })
  it('does not show a match whose entry is gone (it was edited)', () => {
    const books = withRunningBalance([book('j9', '2026-10-01', 500, 0)])
    const p = partition(books, [bank('s1', '2026-10-01', 500, 0)], [saved('m1', ['s1'], ['gone'])])
    expect(p.matched).toHaveLength(0)
    expect(p.booksOnly).toHaveLength(1)
    expect(p.bankOnly).toHaveLength(1)
  })
  it('keeps a group together', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 0, 300), book('j2', '2026-10-01', 0, 200)])
    const p = partition(books, [bank('s1', '2026-10-02', 0, 500)], [saved('m1', ['s1'], ['j1', 'j2'], 'GRP-0001')])
    expect(p.matched[0].groupRef).toBe('GRP-0001')
    expect(p.matched[0].total).toBe(500)
    expect(p.matched[0].difference).toBe(0)
  })
})

describe('suggest', () => {
  it('proposes the same amount on the same side and leaves the rest', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 0, 250), book('j2', '2026-10-05', 0, 40)])
    const lines = [bank('s1', '2026-10-01', 0, 250), bank('s2', '2026-10-09', 12, 0)]
    const r = suggest(books, lines, { days: 0, forbidden: [] })
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0].books[0].id).toBe('j1')
    expect(r.booksLeft.map((b) => b.id)).toEqual(['j2'])
    expect(r.bankLeft.map((b) => b.id)).toEqual(['s2'])
  })
  it('suggests a group when several entries add up to one statement line', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 0, 300), book('j2', '2026-10-01', 0, 200)])
    const r = suggest(books, [bank('s1', '2026-10-01', 0, 500)], { days: 0, forbidden: [] })
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0].books).toHaveLength(2)
  })
  it('never joins a pair that was unmatched', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 0, 250)])
    const r = suggest(books, [bank('s1', '2026-10-01', 0, 250)], { days: 0, forbidden: [{ bankLineId: 's1', ledgerKey: ledgerKey(books[0]) }] })
    expect(r.suggestions).toHaveLength(0)
  })
})

describe('groupProblem', () => {
  const books = withRunningBalance([book('j1', '2026-10-01', 0, 300), book('j2', '2026-10-01', 0, 200)])
  it('accepts sides that add up, within 99 paise', () => {
    expect(groupProblem([bank('s1', '2026-10-01', 0, 500)], books)).toBeNull()
    expect(groupProblem([bank('s1', '2026-10-01', 0, 500.5)], books)).toBeNull()
  })
  it('says by how much the sides differ', () => {
    expect(groupProblem([bank('s1', '2026-10-01', 0, 520)], books)).toContain('20.00')
  })
  it('refuses money in against money out and empty sides', () => {
    expect(groupProblem([bank('s1', '2026-10-01', 500, 0)], books)).toContain('Money in and money out')
    expect(groupProblem([], books)).toContain('at least one')
  })
})

describe('passesFilter', () => {
  it('filters on matched and reviewed', () => {
    expect(passesFilter('matched', { matched: true, reviewed: false })).toBe(true)
    expect(passesFilter('unmatched', { matched: true, reviewed: false })).toBe(false)
    expect(passesFilter('reviewed', { matched: false, reviewed: true })).toBe(true)
    expect(passesFilter('unreviewed', { matched: false, reviewed: true })).toBe(false)
    expect(passesFilter('all', { matched: false, reviewed: false })).toBe(true)
  })
})

describe('summarise', () => {
  it('counts matches and the net still to explain', () => {
    const books = withRunningBalance([book('j1', '2026-10-01', 0, 40)])
    const s = summarise({ matched: [], suggested: [], booksOnly: books, bankOnly: [bank('s1', '2026-10-02', 100, 0)] })
    expect(s.unmatchedBooks).toBe(1)
    expect(s.unmatchedBank).toBe(1)
    expect(s.difference).toBe(140)
  })
})
