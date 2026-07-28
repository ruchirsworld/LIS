import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_dashboard_kpis').select('*').single()
      if (error) throw error
      return data
    },
  })
}
