import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type AttendanceInsert = Database['public']['Tables']['attendance']['Insert']
type TeamTrackerInsert = Database['public']['Tables']['team_tracker']['Insert']
type TeamTrackerPaymentInsert = Database['public']['Tables']['team_tracker_payments']['Insert']
type SalaryPaymentInsert = Database['public']['Tables']['salary_payments']['Insert']
type SalaryPaymentUpdate = Database['public']['Tables']['salary_payments']['Update']
type SalaryAdjustmentInsert = Database['public']['Tables']['salary_adjustments']['Insert']
type SalaryAdjustmentUpdate = Database['public']['Tables']['salary_adjustments']['Update']

export function useAttendance(range: DateRange | null) {
  return useQuery({
    queryKey: ['attendance', range],
    queryFn: async () => {
      let query = supabase.from('attendance').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: AttendanceInsert) => {
      const { data, error } = await supabase.from('attendance').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useDeleteAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attendance').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  })
}

export function useTeamTracker(range: DateRange | null) {
  return useQuery({
    queryKey: ['team_tracker', range],
    queryFn: async () => {
      let query = supabase.from('team_tracker').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateTeamTracker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: TeamTrackerInsert) => {
      const { data, error } = await supabase.from('team_tracker').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_tracker'] }),
  })
}

export function useDeleteTeamTracker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_tracker').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_tracker'] }),
  })
}

/** All payments across all entries — small dataset, fetched once and grouped client-side. */
export function useTeamTrackerPayments() {
  return useQuery({
    queryKey: ['team_tracker_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_tracker_payments').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateTeamTrackerPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: TeamTrackerPaymentInsert) => {
      const { data, error } = await supabase.from('team_tracker_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_tracker_payments'] }),
  })
}

/** All salary payments — small dataset, fetched once and grouped/filtered client-side. */
export function useSalaryPayments() {
  return useQuery({
    queryKey: ['salary_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_payments').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateSalaryPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: SalaryPaymentInsert) => {
      const { data, error } = await supabase.from('salary_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_payments'] }),
  })
}

export function useUpdateSalaryPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SalaryPaymentUpdate }) => {
      const { error } = await supabase.from('salary_payments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_payments'] }),
  })
}

export function useDeleteSalaryPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salary_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_payments'] }),
  })
}

/** All salary adjustments — small dataset, fetched once and grouped/filtered client-side. */
export function useSalaryAdjustments() {
  return useQuery({
    queryKey: ['salary_adjustments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_adjustments').select('*').order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCreateSalaryAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: SalaryAdjustmentInsert) => {
      const { data, error } = await supabase.from('salary_adjustments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_adjustments'] }),
  })
}

export function useUpdateSalaryAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SalaryAdjustmentUpdate }) => {
      const { error } = await supabase.from('salary_adjustments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_adjustments'] }),
  })
}

export function useDeleteSalaryAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salary_adjustments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary_adjustments'] }),
  })
}
