import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type TripInsert = Database['public']['Tables']['trips']['Insert']
type TripUpdate = Database['public']['Tables']['trips']['Update']

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (trip: TripInsert) => {
      const { data, error } = await supabase.from('trips').insert(trip).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })
}

export function useUpdateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TripUpdate }) => {
      const { error } = await supabase.from('trips').update(patch).eq('id', id)
      if (error) throw error
      // Keep every expense already logged on this trip in sync with its
      // project — otherwise relinking a trip to a different project leaves
      // its existing entries silently attributed to the old one (or none).
      if ('project_id' in patch) {
        const { error: syncError } = await supabase
          .from('expenses')
          .update({ project_id: patch.project_id ?? null })
          .eq('trip_id', id)
        if (syncError) throw syncError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })
}
