import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type TransferInsert = Database['public']['Tables']['transfers']['Insert']
type TransferUpdate = Database['public']['Tables']['transfers']['Update']

/** A transfer moves money between accounts, so everything that shows a balance is refreshed. */
function refreshBalances(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['transfers', 'ledger_lines', 'bank_lines', 'dashboard-kpis', 'trial_balance', 'books_health', 'gl_balances']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useTransfers(range: DateRange | null) {
  return useQuery({
    queryKey: ['transfers', range],
    queryFn: async () => {
      let query = supabase.from('transfers').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (transfer: TransferInsert) => {
      const { data, error } = await supabase.from('transfers').insert(transfer).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transfers'] }),
  })
}

export function useUpdateTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TransferUpdate }) => {
      const { data, error } = await supabase.from('transfers').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => refreshBalances(qc),
  })
}

export function useDeleteTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transfers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refreshBalances(qc),
  })
}
