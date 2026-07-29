import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type LoanInsert = Database['public']['Tables']['loans']['Insert']
type LoanUpdate = Database['public']['Tables']['loans']['Update']
type LoanPaymentInsert = Database['public']['Tables']['loan_payments']['Insert']

export function useLoans(range: DateRange | null) {
  return useQuery({
    queryKey: ['loans', range],
    queryFn: async () => {
      let query = supabase.from('loans').select('*').order('date_taken', { ascending: false })
      if (range?.from) query = query.gte('date_taken', range.from)
      if (range?.to) query = query.lte('date_taken', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (loan: LoanInsert) => {
      const { data, error } = await supabase.from('loans').insert(loan).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: LoanUpdate }) => {
      const { data, error } = await supabase.from('loans').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loan_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useLoanPayments() {
  return useQuery({
    queryKey: ['loan_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('loan_payments').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateLoanPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: LoanPaymentInsert) => {
      const { data, error } = await supabase.from('loan_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}
