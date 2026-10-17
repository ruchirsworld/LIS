import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/reportPeriod'

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

export interface DuplicatePair {
  a_table: string
  a_id: string
  a_display_id: string | null
  a_kind: string
  a_date: string
  a_recorded_at: string
  a_description: string | null
  a_entered_by: string | null
  b_table: string
  b_id: string
  b_display_id: string | null
  b_kind: string
  b_date: string
  b_recorded_at: string
  b_description: string | null
  b_entered_by: string | null
  amount: number
  dismissed: boolean
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

/** Groups pairs into clusters: entries linked directly or through others. */
export function clusterPairs(pairs: DuplicatePair[]): { key: string; entries: { table: string; id: string; displayId: string | null; kind: string; date: string; recordedAt: string; description: string | null; enteredBy: string | null }[]; amount: number; pairKeys: [string, string][] }[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  const info = new Map<string, { table: string; id: string; displayId: string | null; kind: string; date: string; recordedAt: string; description: string | null; enteredBy: string | null }>()
  for (const p of pairs) {
    const ka = `${p.a_table}:${p.a_id}`
    const kb = `${p.b_table}:${p.b_id}`
    info.set(ka, { table: p.a_table, id: p.a_id, displayId: p.a_display_id, kind: p.a_kind, date: p.a_date, recordedAt: p.a_recorded_at, description: p.a_description, enteredBy: p.a_entered_by })
    info.set(kb, { table: p.b_table, id: p.b_id, displayId: p.b_display_id, kind: p.b_kind, date: p.b_date, recordedAt: p.b_recorded_at, description: p.b_description, enteredBy: p.b_entered_by })
    parent.set(find(ka), find(kb))
  }
  const groups = new Map<string, { keys: Set<string>; amount: number; pairKeys: [string, string][] }>()
  for (const p of pairs) {
    const ka = `${p.a_table}:${p.a_id}`
    const kb = `${p.b_table}:${p.b_id}`
    const root = find(ka)
    const g = groups.get(root) ?? { keys: new Set<string>(), amount: p.amount, pairKeys: [] }
    g.keys.add(ka)
    g.keys.add(kb)
    g.pairKeys.push([ka, kb])
    groups.set(root, g)
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      amount: g.amount,
      pairKeys: g.pairKeys,
      entries: [...g.keys].map((k) => info.get(k)!).sort((x, y) => y.date.localeCompare(x.date) || y.recordedAt.localeCompare(x.recordedAt)),
    }))
    .sort((a, b) => b.amount - a.amount)
}
