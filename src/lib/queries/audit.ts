import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface AuditLogRow {
  id: string
  table_name: string
  row_id: string | null
  operation: 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

/** Every recorded edit/delete across the audited financial tables — who
 * changed what, when, and what it looked like before and after. */
export function useAuditLog() {
  return useQuery({
    queryKey: ['audit_log'],
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(500)
      if (error) throw error
      return data as AuditLogRow[]
    },
  })
}
