import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type CapitalTxInsert = Database['public']['Tables']['capital_transactions']['Insert']

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

export function useDeleteCapitalTx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('capital_transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capital_transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}
