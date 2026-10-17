import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { trashRecord } from './trash'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type CapitalTxInsert = Database['public']['Tables']['capital_transactions']['Insert']
type CapitalTxUpdate = Database['public']['Tables']['capital_transactions']['Update']

/** Capital moves money, so everything that shows a balance is refreshed with it. */
function refreshAll(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['capital_transactions', 'dashboard-kpis', 'ledger_lines', 'bank_lines', 'trial_balance', 'books_health', 'gl_balances']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useCapitalTx(range: DateRange | null) {
  return useQuery({
    queryKey: ['capital_transactions', range],
    queryFn: async () => {
      let query = supabase.from('capital_transactions').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateCapitalTx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tx: CapitalTxInsert) => {
      const { data, error } = await supabase.from('capital_transactions').insert(tx).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capital_transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateCapitalTx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CapitalTxUpdate }) => {
      const { data, error } = await supabase.from('capital_transactions').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => refreshAll(qc),
  })
}

export function useDeleteCapitalTx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await trashRecord('capital_transactions', id, { qc })
    },
    onSuccess: () => refreshAll(qc),
  })
}
