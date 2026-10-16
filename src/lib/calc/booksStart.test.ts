import { describe, expect, it } from 'vitest'
import { describeBooksStart, isCounted, startsFromOpenings } from './booksStart'

const accounts = [
  { id: null, name: 'Cash' },
  { id: 'k', name: 'Kotak' },
  { id: 'c', name: 'CBI' },
]

describe('books start date', () => {
  const starts = startsFromOpenings([
    { bank_account_id: 'k', as_on: '2026-10-01' },
    { bank_account_id: null, as_on: '2026-10-01' },
  ])

  it('counts an entry from its account start date, including that day, and not before', () => {
    expect(isCounted(starts, 'k', '2026-10-01')).toBe(true)
    expect(isCounted(starts, 'k', '2026-09-30')).toBe(false)
    expect(isCounted(starts, null, '2026-10-16')).toBe(true)
  })

  it('leaves out an account that has no opening balance', () => {
    expect(isCounted(starts, 'c', '2026-10-16')).toBe(false)
  })

  it('says where the figure counts from, and which account is left out', () => {
    expect(describeBooksStart(accounts, starts)).toEqual({ counted: 'Counted from 01 Oct 2026', missing: ['CBI'] })
  })

  it('names each account when the start dates differ', () => {
    const mixed = startsFromOpenings([
      { bank_account_id: 'k', as_on: '2026-10-01' },
      { bank_account_id: 'c', as_on: '2026-09-01' },
      { bank_account_id: null, as_on: '2026-10-01' },
    ])
    expect(describeBooksStart(accounts, mixed).counted).toBe('Counted from Cash 01 Oct 2026, Kotak 01 Oct 2026, CBI 01 Sep 2026')
  })

  it('says nothing is counted when no account has an opening balance', () => {
    expect(describeBooksStart(accounts, new Map())).toEqual({ counted: '', missing: ['Cash', 'Kotak', 'CBI'] })
  })
})
