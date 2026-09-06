import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

export const TEAM_EXPENSE_WARNING_THRESHOLD_KEY = 'team_expense_warning_threshold'
export const TEAM_EXPENSE_WARNING_THRESHOLD_DEFAULT = 500

// A small key/value table of admin/cxo-tunable numeric thresholds — RLS lets
// any authenticated user read it, but only admin/cxo update it (enforced in
// the DB, not just hidden in the UI).
export function useAppSettings() {
  return useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*')
      if (error) throw error
      return new Map(data.map((row) => [row.key, Number(row.value)]))
    },
  })
}

export function useUpdateAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings'] }),
  })
}
