import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { selectByIds } from './byIds'

// Opening balances of cash and bank accounts (posted to the books) and the statement's balance at the start of each
// month (a check only). A null account is Cash in hand.

export function useAccountOpenings() {
  return useQuery({
    queryKey: ['account_openings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_openings').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useMonthBalances() {
  return useQuery({
    queryKey: ['account_month_balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_month_balances').select('*')
      if (error) throw error
      return data
    },
  })
}

/** Everything that depends on the account balances, so a new opening shows up everywhere at once. */
function refreshBooks(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['account_openings', 'account_month_balances', 'ledger_lines', 'bank_lines', 'dashboard-kpis', 'gl_balances', 'books_health', 'cash_bank_movements']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

/** Sets (or clears) the opening balance of an account. One per account: it is changed, not added to. */
export function useSaveAccountOpening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankAccountId, asOn, amount, notes }: { bankAccountId: string | null; asOn: string; amount: number | null; notes?: string | null }) => {
      const existing = supabase.from('account_openings').select('id')
      const { data: found, error: findError } = await (bankAccountId ? existing.eq('bank_account_id', bankAccountId) : existing.is('bank_account_id', null)).maybeSingle()
      if (findError) throw findError
      if (amount === null) {
        if (found) {
          const { error } = await supabase.from('account_openings').delete().eq('id', found.id)
          if (error) throw error
        }
        return
      }
      if (found) {
        const { error } = await supabase.from('account_openings').update({ as_on: asOn, amount, notes: notes ?? null }).eq('id', found.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('account_openings').insert({ bank_account_id: bankAccountId, as_on: asOn, amount, notes: notes ?? null })
        if (error) throw error
      }
    },
    onSuccess: () => refreshBooks(qc),
  })
}

/** Sets (or clears, with null) what the statement shows at the start of a month. */
export function useSaveMonthBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankAccountId, month, balance }: { bankAccountId: string | null; month: string; balance: number | null }) => {
      const base = supabase.from('account_month_balances').select('id').eq('month', month)
      const { data: found, error: findError } = await (bankAccountId ? base.eq('bank_account_id', bankAccountId) : base.is('bank_account_id', null)).maybeSingle()
      if (findError) throw findError
      if (balance === null) {
        if (found) {
          const { error } = await supabase.from('account_month_balances').delete().eq('id', found.id)
          if (error) throw error
        }
        return
      }
      if (found) {
        const { error } = await supabase.from('account_month_balances').update({ balance }).eq('id', found.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('account_month_balances').insert({ bank_account_id: bankAccountId, month, balance })
        if (error) throw error
      }
    },
    meta: { quiet: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account_month_balances'] }),
  })
}

export interface AccountMovement {
  date: string
  bank_account_id: string | null
  debit: number
  credit: number
  /** What made the entry, so the opening balance can be told apart from real movements. */
  source_table: string | null
}

/** Every movement in Cash and the banks, with what made it. */
export function useAccountMovements() {
  return useQuery({
    queryKey: ['ledger_lines', 'account_movements'],
    queryFn: async (): Promise<AccountMovement[]> => {
      const { data: accounts, error: accountsError } = await supabase.from('gl_accounts').select('id').in('code', ['1010', '1020'])
      if (accountsError) throw accountsError
      const ids = (accounts ?? []).map((a) => a.id)
      if (ids.length === 0) return []
      const { data: lines, error } = await supabase.from('journal_lines').select('entry_id, bank_account_id, debit, credit').in('gl_account_id', ids)
      if (error) throw error
      if (!lines || lines.length === 0) return []
      const entries = await selectByIds<{ id: string; date: string; source_table: string | null }>('journal_entries', 'id, date, source_table', 'id', [...new Set(lines.map((l) => l.entry_id))])
      const byId = new Map(entries.map((e) => [e.id, e]))
      return lines.map((l) => ({
        date: byId.get(l.entry_id)?.date ?? '',
        source_table: byId.get(l.entry_id)?.source_table ?? null,
        bank_account_id: l.bank_account_id,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }))
    },
  })
}
