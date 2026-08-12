import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']
type ExpenseReimbursementInsert = Database['public']['Tables']['expense_reimbursements']['Insert']
type ExpenseReimbursementUpdate = Database['public']['Tables']['expense_reimbursements']['Update']

export function useExpenses(range: DateRange | null) {
  return useQuery({
    queryKey: ['expenses', range],
    queryFn: async () => {
      let query = supabase.from('expenses').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      const { data, error } = await supabase.from('expenses').insert(expense).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ExpenseUpdate }) => {
      const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useBulkUpdateExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: ExpenseUpdate }) => {
      const { error } = await supabase.from('expenses').update(patch).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useBulkDeleteExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('expenses').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useExpenseReimbursements() {
  return useQuery({
    queryKey: ['expense_reimbursements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_reimbursements').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateExpenseReimbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: ExpenseReimbursementInsert) => {
      const { data, error } = await supabase.from('expense_reimbursements').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense_reimbursements'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateExpenseReimbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ExpenseReimbursementUpdate }) => {
      const { data, error } = await supabase.from('expense_reimbursements').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense_reimbursements'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteExpenseReimbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_reimbursements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense_reimbursements'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useApproveExpenseReimbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approverId }: { id: string; approverId: string }) => {
      const { data, error } = await supabase
        .from('expense_reimbursements')
        .update({ approved_by: approverId, approved_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_reimbursements'] }),
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('vendors').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}
