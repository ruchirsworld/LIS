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

export interface CashBankLine {
  date: string
  /** null = Cash in Hand (account 1010); a real id = that specific bank
   * account (account 1020, shared by every bank — bank_account_id says
   * which one, the same way profile_id distinguishes supervisors above). */
  bank_account_id: string | null
  debit: number
  credit: number
}

/** Every journal line ever posted to Cash-in-Hand or Bank — the real
 * accounting position, not just what's been logged via the Transfers tab
 * (expenses paid, invoice payments received, site imprest advances/returns
 * all post here directly too). Backs the Cash & Bank report; the Dashboard's
 * "Cash & bank" KPI is this same total via v_dashboard_kpis instead. */
export function useCashAndBankLines() {
  return useQuery({
    queryKey: ['ledger_lines', 'cash_and_bank'],
    queryFn: async (): Promise<CashBankLine[]> => {
      const { data: accounts, error: accountsError } = await supabase
        .from('gl_accounts')
        .select('id')
        .in('code', ['1010', '1020'])
      if (accountsError) throw accountsError
      const accountIds = (accounts ?? []).map((a) => a.id)
      if (accountIds.length === 0) return []

      const { data: lines, error: linesError } = await supabase
        .from('journal_lines')
        .select('entry_id, bank_account_id, debit, credit')
        .in('gl_account_id', accountIds)
      if (linesError) throw linesError
      if (!lines || lines.length === 0) return []

      const entryIds = [...new Set(lines.map((l) => l.entry_id))]
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id, date')
        .in('id', entryIds)
      if (entriesError) throw entriesError
      const dateById = new Map((entries ?? []).map((e) => [e.id, e.date]))

      return lines.map((l) => ({
        date: dateById.get(l.entry_id) ?? '',
        bank_account_id: l.bank_account_id,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }))
    },
  })
}

export interface CashMovement {
  date: string
  net: number
}

/** Net movement in Cash-in-Hand + Bank per day over the last `days` days —
 * the Dashboard works the Cash & bank sparkline backwards from today's
 * balance with it, so only that window is fetched, not every line ever. */
export function useCashMovements(days = 30) {
  return useQuery({
    queryKey: ['ledger_lines', 'cash_movements', days],
    queryFn: async (): Promise<CashMovement[]> => {
      const { data: accounts, error: accountsError } = await supabase
        .from('gl_accounts')
        .select('id')
        .in('code', ['1010', '1020'])
      if (accountsError) throw accountsError
      const accountIds = (accounts ?? []).map((a) => a.id)
      if (accountIds.length === 0) return []

      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('journal_lines')
        .select('debit, credit, journal_entries!inner(date)')
        .in('gl_account_id', accountIds)
        .gte('journal_entries.date', sinceISO)
      if (error) throw error

      const byDate = new Map<string, number>()
      for (const row of data ?? []) {
        const entry = row.journal_entries as unknown as { date: string } | { date: string }[] | null
        const date = Array.isArray(entry) ? entry[0]?.date : entry?.date
        if (!date) continue
        byDate.set(date, (byDate.get(date) ?? 0) + Number(row.debit || 0) - Number(row.credit || 0))
      }
      return [...byDate.entries()].map(([date, net]) => ({ date, net }))
    },
  })
}
