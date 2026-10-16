// Cash & bank counts each account only from the day its opening balance was entered (its "books start").
// Entries dated before that day stay saved and visible on their own screens; they are just not counted yet.
// An account with no opening balance is left out, not guessed.

import { fmtDate } from './format'

/** Books start date by account: the bank account id, or 'cash' for Cash in hand. */
export type BooksStarts = Map<string, string>

export const CASH_KEY = 'cash'
export const startKey = (bankAccountId: string | null) => bankAccountId ?? CASH_KEY

export function startsFromOpenings(openings: { bank_account_id: string | null; as_on: string }[]): BooksStarts {
  return new Map(openings.map((o) => [startKey(o.bank_account_id), o.as_on]))
}

/** True when an entry on `date` in this account is inside the period the books cover. */
export function isCounted(starts: BooksStarts, bankAccountId: string | null, date: string): boolean {
  const from = starts.get(startKey(bankAccountId))
  return from !== undefined && date >= from
}

export interface StartSummary {
  /** "Counted from 1 Oct 2026", or "Kotak from 1 Oct 2026, CBI from 1 Sep 2026" when they differ. Empty when none is set. */
  counted: string
  /** Accounts with no opening balance, which are left out of the total. */
  missing: string[]
}

export function describeBooksStart(accounts: { id: string | null; name: string }[], starts: BooksStarts): StartSummary {
  const set = accounts.filter((a) => starts.has(startKey(a.id)))
  const missing = accounts.filter((a) => !starts.has(startKey(a.id))).map((a) => a.name)
  const dates = [...new Set(set.map((a) => starts.get(startKey(a.id)) as string))]
  const counted =
    dates.length === 0
      ? ''
      : dates.length === 1
        ? `Counted from ${fmtDate(dates[0])}`
        : `Counted from ${set.map((a) => `${a.name} ${fmtDate(starts.get(startKey(a.id)))}`).join(', ')}`
  return { counted, missing }
}
