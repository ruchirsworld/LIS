import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type HolidayInsert = Database['public']['Tables']['holidays']['Insert']
type WageAccrualInsert = Database['public']['Tables']['wage_accruals']['Insert']
type WagePaymentInsert = Database['public']['Tables']['wage_payments']['Insert']
type StaffImprestTransactionInsert = Database['public']['Tables']['staff_imprest_transactions']['Insert']
type StaffImprestTransactionUpdate = Database['public']['Tables']['staff_imprest_transactions']['Update']
type StaffSalaryAdvanceInsert = Database['public']['Tables']['staff_salary_advances']['Insert']

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: HolidayInsert) => {
      const { data, error } = await supabase.from('holidays').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useWageAccruals() {
  return useQuery({
    queryKey: ['wage_accruals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wage_accruals').select('*').order('period_end', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateWageAccrual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: WageAccrualInsert) => {
      const { data, error } = await supabase.from('wage_accruals').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wage_accruals'] }),
  })
}

export function useWagePayments() {
  return useQuery({
    queryKey: ['wage_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wage_payments').select('*').order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateWagePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: WagePaymentInsert) => {
      const { data, error } = await supabase.from('wage_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wage_payments'] }),
  })
}

export function useStaffImprestTransactions() {
  return useQuery({
    queryKey: ['staff_imprest_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_imprest_transactions').select('*').order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateStaffImprestTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: StaffImprestTransactionInsert) => {
      const { data, error } = await supabase.from('staff_imprest_transactions').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_imprest_transactions'] }),
  })
}

export function useUpdateStaffImprestTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: StaffImprestTransactionUpdate }) => {
      const { data, error } = await supabase.from('staff_imprest_transactions').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_imprest_transactions'] })
      qc.invalidateQueries({ queryKey: ['ledger_lines'] })
    },
  })
}

export function useDeleteStaffImprestTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_imprest_transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_imprest_transactions'] })
      qc.invalidateQueries({ queryKey: ['ledger_lines'] })
    },
  })
}

export function useStaffSalaryAdvances() {
  return useQuery({
    queryKey: ['staff_salary_advances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_salary_advances').select('*').order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateStaffSalaryAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: StaffSalaryAdvanceInsert) => {
      const { data, error } = await supabase.from('staff_salary_advances').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_salary_advances'] }),
  })
}
