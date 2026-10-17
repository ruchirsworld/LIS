import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type OtherReceiptInsert = Database['public']['Tables']['other_receipts']['Insert']
type OtherReceiptUpdate = Database['public']['Tables']['other_receipts']['Update']

export function useOtherReceipts(range: DateRange | null) {
  return useQuery({
    queryKey: ['other_receipts', range],
    queryFn: async () => {
      let query = supabase.from('other_receipts').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

// A receipt moves cash or a bank account and posts to the books, so everything that reads those refetches.
function refreshBooks(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['other_receipts', 'bank_lines', 'ledger_lines', 'gl_balances', 'dashboard-kpis', 'books_health']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useCreateOtherReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: OtherReceiptInsert) => {
      const { data, error } = await supabase.from('other_receipts').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => refreshBooks(qc),
  })
}

export function useUpdateOtherReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: OtherReceiptUpdate }) => {
      const { data, error } = await supabase.from('other_receipts').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => refreshBooks(qc),
  })
}

export function useDeleteOtherReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('other_receipts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refreshBooks(qc),
  })
}
