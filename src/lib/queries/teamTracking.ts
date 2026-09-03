import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

// Supervisor "team tracking" — mirrors LIS_Fields' AttendanceRecord /
// WorkerSiteAssignment / LocationPing, adapted to ERP2.0's Staff/Project model.

type AttendanceInsert = Database['public']['Tables']['staff_attendance']['Insert']
type ProjectAssignmentInsert = Database['public']['Tables']['staff_project_assignments']['Insert']
type LocationPingInsert = Database['public']['Tables']['staff_location_pings']['Insert']

export function useStaffAttendanceForDate(date: string) {
  return useQuery({
    queryKey: ['staff_attendance', 'date', date],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_attendance').select('*').eq('date', date)
      if (error) throw error
      return data
    },
  })
}

export function useAllStaffAttendance() {
  return useQuery({
    queryKey: ['staff_attendance', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_attendance').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useMarkLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: AttendanceInsert) => {
      const { error } = await supabase.from('staff_attendance').upsert(row, { onConflict: 'staff_id,date' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_attendance'] }),
  })
}

export function useRemoveLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ staffId, date }: { staffId: string; date: string }) => {
      const { error } = await supabase.from('staff_attendance').delete().eq('staff_id', staffId).eq('date', date)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_attendance'] }),
  })
}

export function useStaffProjectAssignmentsForDate(date: string) {
  return useQuery({
    queryKey: ['staff_project_assignments', 'date', date],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_project_assignments').select('*').eq('date', date)
      if (error) throw error
      return data
    },
  })
}

export function useAllStaffProjectAssignments() {
  return useQuery({
    queryKey: ['staff_project_assignments', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_project_assignments').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useSetStaffProjectAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: ProjectAssignmentInsert) => {
      const { error } = await supabase.from('staff_project_assignments').upsert(row, { onConflict: 'staff_id,date' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_project_assignments'] }),
  })
}

export function useClearStaffProjectAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ staffId, date }: { staffId: string; date: string }) => {
      const { error } = await supabase.from('staff_project_assignments').delete().eq('staff_id', staffId).eq('date', date)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_project_assignments'] }),
  })
}

export function useInsertLocationPing() {
  return useMutation({
    mutationFn: async (row: LocationPingInsert) => {
      const { error } = await supabase.from('staff_location_pings').insert(row)
      if (error) throw error
    },
  })
}

/** Every Supervisor's location check-in from tapping Start Work — an
 * Admin/CXO view of where a Supervisor last pinged from. */
export function useLocationPings() {
  return useQuery({
    queryKey: ['staff_location_pings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_location_pings').select('*').order('taken_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
