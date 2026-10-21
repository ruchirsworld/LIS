import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/reportPeriod'
import type { DuplicatePair } from './duplicateClusters'

export { clusterPairs, type DuplicatePair } from './duplicateClusters'

// activity_feed and possible_duplicates come from the Phase 5 migration, so they are not in the generated types yet.

export interface FeedRow {
  activity_date: string
  recorded_at: string
  kind: string
  source_table: string
  source_id: string
  display_id: string | null
  description: string | null
  amount: number | null
  direction: string | null
  status: string | null
  reimbursable: boolean
  reimburse_to: string | null
  entered_by: string | null
  on_behalf_of: string | null
  cost_center: string | null
  project_name: string | null
  trip_name: string | null
  has_receipt: boolean | null
  checked_by: string | null
  checked_at: string | null
}

/** Every entry in every module, newest entered first. For one person: what they entered and what was entered on their behalf. */
export function useActivityFeed(userId: string | null, range: DateRange | null, byRecorded: boolean) {
  return useQuery({
    queryKey: ['activity_feed', userId, range, byRecorded],
    queryFn: async (): Promise<FeedRow[]> => {
      const { data, error } = await supabase.rpc('activity_feed', {
        p_user: userId ?? undefined,
        p_from: range?.from ?? undefined,
        p_to: range?.to ?? undefined,
        p_by_recorded: byRecorded,
      })
      if (error) throw error
      return (data ?? []) as unknown as FeedRow[]
    },
  })
}

export function usePossibleDuplicates(range: DateRange | null) {
  return useQuery({
    queryKey: ['possible_duplicates', range],
    queryFn: async (): Promise<DuplicatePair[]> => {
      const { data, error } = await supabase.rpc('possible_duplicates', { p_from: range?.from ?? undefined, p_to: range?.to ?? undefined })
      if (error) throw error
      return (data ?? []) as unknown as DuplicatePair[]
    },
  })
}

const dismissals = () => supabase.from('duplicate_dismissals' as 'expenses') as unknown as {
  insert: (v: { key_a: string; key_b: string }) => Promise<{ error: unknown }>
  delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
}

/** "Not a duplicate": hides the pair from the report. Undo removes the mark. */
export function useDismissPair() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ a, b, dismiss }: { a: string; b: string; dismiss: boolean }) => {
      const [key_a, key_b] = a < b ? [a, b] : [b, a]
      if (dismiss) {
        const { error } = await dismissals().insert({ key_a, key_b })
        if (error) throw error
      } else {
        const { error } = await dismissals().delete().eq('key_a', key_a).eq('key_b', key_b)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['possible_duplicates'] }),
  })
}

/** The remarks typed on expenses and vendor bills, for the entries on screen (the activity list does not carry them). */
export function useEntryRemarks(rows: { source_table: string; source_id: string }[], enabled = true) {
  const pick = (t: string) => [...new Set(rows.filter((r) => r.source_table === t).map((r) => r.source_id))].sort()
  const expenseIds = pick('expenses')
  const billIds = pick('vendor_bills')
  return useQuery({
    queryKey: ['entry_remarks', expenseIds.join(','), billIds.join(',')],
    enabled: enabled && expenseIds.length + billIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const out = new Map<string, string>()
      const read = async (table: 'expenses' | 'vendor_bills', ids: string[]) => {
        for (let i = 0; i < ids.length; i += 80) {
          const { data, error } = await supabase.from(table).select('id, remarks').in('id', ids.slice(i, i + 80))
          if (error) throw error
          for (const r of data ?? []) if (r.remarks) out.set(r.id, r.remarks)
        }
      }
      await Promise.all([read('expenses', expenseIds), read('vendor_bills', billIds)])
      return out
    },
  })
}
