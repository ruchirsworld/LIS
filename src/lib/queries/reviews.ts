import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

// "Reviewed" ticks for any kind of record. Kept in their own table, so no record table changes for it.
// A record with no tick is "Saved"; ticked, it is "Reviewed".
export interface ReviewRow {
  reviewed_by: string | null
  reviewed_at: string
}

// The table is new in the Phase 4 migration, so it is not in the generated types yet.
const reviews = () => supabase.from('record_reviews' as 'expenses') as unknown as {
  select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: ReviewRow | null; error: unknown }> } } }
  upsert: (v: { table_name: string; record_id: string }, o: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: unknown }>
  delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
}

export function useReview(table: string, id: string, enabled = true) {
  return useQuery({
    queryKey: ['record_review', table, id],
    enabled,
    queryFn: async () => {
      const { data, error } = await reviews().select('reviewed_by, reviewed_at').eq('table_name', table).eq('record_id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSetReviewed(table: string, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewed: boolean) => {
      if (reviewed) {
        // Ticking a record that is already ticked is not an error: it stays ticked.
        const { error } = await reviews().upsert({ table_name: table, record_id: id }, { onConflict: 'table_name,record_id', ignoreDuplicates: true })
        if (error) throw error
      } else {
        const { error } = await reviews().delete().eq('table_name', table).eq('record_id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record_review', table, id] })
      // The lists that show the tick (Activity by user, today's summary) read it too.
      qc.invalidateQueries({ queryKey: ['activity_feed'] })
    },
  })
}
