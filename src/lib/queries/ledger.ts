import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface LedgerLine {
  id: string
  date: string
  description: string
  debit: number
  credit: number
}

/** Every journal line posted to one GL account, for one party (client,
 * vendor, loan, partner, a supervisor's site imprest, or a staff member's
 * salary advance) — the transaction-by-transaction ledger behind that
 * party's summary total elsewhere in Reports. Joins journal_lines to
 * journal_entries in two queries rather than a PostgREST embed, matching
 * how the rest of the app composes report data client-side. */
export function useLedgerLines(
  glAccountCode: string,
  partyColumn: 'client_id' | 'vendor_id' | 'loan_id' | 'partner_id' | 'profile_id' | 'staff_id',
  partyId: string | null
) {
  return useQuery({
    queryKey: ['ledger_lines', glAccountCode, partyColumn, partyId],
    enabled: !!partyId,
    queryFn: async (): Promise<LedgerLine[]> => {
      const { data: account, error: accountError } = await supabase
        .from('gl_accounts')
        .select('id')
        .eq('code', glAccountCode)
        .single()
      if (accountError) throw accountError

      const { data: lines, error: linesError } = await supabase
        .from('journal_lines')
        .select('id, entry_id, debit, credit')
        .eq('gl_account_id', account.id)
        .eq(partyColumn, partyId as string)
      if (linesError) throw linesError
      if (!lines || lines.length === 0) return []

      const entryIds = [...new Set(lines.map((l) => l.entry_id))]
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id, date, description')
        .in('id', entryIds)
      if (entriesError) throw entriesError
      const entryById = new Map((entries ?? []).map((e) => [e.id, e]))

      return lines
        .map((l) => {
          const entry = entryById.get(l.entry_id)
          return {
            id: l.id,
            date: entry?.date ?? '',
            description: entry?.description ?? '',
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    },
  })
}

/** Every supervisor's current Site Imprest balance at once (debit - credit
 * on account 1060, grouped by profile_id) — used wherever a picker needs to
 * show "how much float do they already have" without one query per row,
 * e.g. the pending-expenses approval panel. */
export function useSiteImprestBalances() {
  return useQuery({
    queryKey: ['ledger_lines', '1060', 'profile_id', 'all'],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data: account, error: accountError } = await supabase
        .from('gl_accounts')
        .select('id')
        .eq('code', '1060')
        .single()
      if (accountError) throw accountError

      const { data: lines, error: linesError } = await supabase
        .from('journal_lines')
        .select('profile_id, debit, credit')
        .eq('gl_account_id', account.id)
        .not('profile_id', 'is', null)
      if (linesError) throw linesError

      const balances = new Map<string, number>()
      for (const l of lines ?? []) {
        const key = l.profile_id as string
        balances.set(key, (balances.get(key) ?? 0) + Number(l.debit || 0) - Number(l.credit || 0))
      }
      return balances
    },
  })
}
