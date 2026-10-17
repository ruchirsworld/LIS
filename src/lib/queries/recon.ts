import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'

// Saved bank reconciliation (Phase 6 migration). The new tables are not in the generated types yet, so they are reached through a small
// untyped handle.
type Loose = {
  select: (cols?: string) => LooseQuery
  insert: (rows: unknown, opts?: unknown) => Promise<{ error: unknown; data?: unknown }>
  upsert: (rows: unknown, opts: { onConflict: string; ignoreDuplicates: boolean }) => { select: (c: string) => Promise<{ error: unknown; data: { id: string }[] | null }> }
  delete: () => LooseQuery & Promise<{ error: unknown }>
}
interface LooseQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq: (c: string, v: string) => LooseQuery
  order: (c: string, o?: { ascending: boolean }) => LooseQuery
  limit: (n: number) => LooseQuery
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
}
const table = (name: string) => supabase.from(name as 'expenses') as unknown as Loose

export interface StatementRecord {
  id: string
  bank_account_id: string
  line_date: string
  description: string
  reference: string
  debit: number
  credit: number
  balance: number | null
  source_file: string | null
}

/** Every saved statement line of one bank account, oldest first. */
export function useStatementLines(bankId: string | null) {
  return useQuery({
    queryKey: ['bank_statement_lines', bankId],
    enabled: !!bankId,
    queryFn: async (): Promise<StatementRecord[]> => {
      const { data, error } = await table('bank_statement_lines').select('*').eq('bank_account_id', bankId as string).order('line_date').order('imported_at')
      if (error) throw error
      return ((data ?? []) as StatementRecord[]).map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit), balance: r.balance === null ? null : Number(r.balance) }))
    },
  })
}

export interface NewStatementLine {
  line_date: string
  description: string
  reference: string
  debit: number
  credit: number
  balance: number | null
  dedupe_key: string
}

/** Saves the lines of a statement. A line that is already saved (the same file again, or an overlapping statement) is skipped. */
export function useSaveStatementLines(bankId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lines, fileName, userId }: { lines: NewStatementLine[]; fileName: string; userId: string }) => {
      let added = 0
      for (let i = 0; i < lines.length; i += 200) {
        const chunk = lines.slice(i, i + 200).map((l) => ({ ...l, bank_account_id: bankId, source_file: fileName, imported_by: userId }))
        const { error, data } = await table('bank_statement_lines').upsert(chunk, { onConflict: 'bank_account_id,dedupe_key', ignoreDuplicates: true }).select('id')
        if (error) throw error
        added += data?.length ?? 0
      }
      return { added, skipped: lines.length - added }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_statement_lines', bankId] }),
  })
}

export function useRemoveStatementLines(bankId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await table('bank_statement_lines').delete().eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_statement_lines', bankId] })
      qc.invalidateQueries({ queryKey: ['bank_matches', bankId] })
      qc.invalidateQueries({ queryKey: ['bank_reconciliations'] })
    },
  })
}

export interface SavedMatch {
  id: string
  group_ref: string | null
  kind: 'auto' | 'manual'
  matched_total: number
  difference: number
  cleared_on: string
  created_at: string
  bankLineIds: string[]
  journalLineIds: string[]
}

/** The saved matches of one bank account, each with the statement lines and books entries it joins. */
export function useBankMatches(bankId: string | null) {
  return useQuery({
    queryKey: ['bank_matches', bankId],
    enabled: !!bankId,
    queryFn: async (): Promise<SavedMatch[]> => {
      const [{ data: ms, error: e1 }, { data: members, error: e2 }] = await Promise.all([
        table('bank_matches').select('*').eq('bank_account_id', bankId as string).order('created_at', { ascending: false }),
        table('bank_match_members').select('match_id, side, bank_line_id, journal_line_id'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const by = new Map<string, { bank: string[]; books: string[] }>()
      for (const m of (members ?? []) as { match_id: string; side: string; bank_line_id: string | null; journal_line_id: string | null }[]) {
        const cur = by.get(m.match_id) ?? { bank: [], books: [] }
        if (m.side === 'bank' && m.bank_line_id) cur.bank.push(m.bank_line_id)
        if (m.side === 'books' && m.journal_line_id) cur.books.push(m.journal_line_id)
        by.set(m.match_id, cur)
      }
      return ((ms ?? []) as Omit<SavedMatch, 'bankLineIds' | 'journalLineIds'>[]).map((m) => ({
        ...m,
        matched_total: Number(m.matched_total),
        difference: Number(m.difference),
        bankLineIds: by.get(m.id)?.bank ?? [],
        journalLineIds: by.get(m.id)?.books ?? [],
      }))
    },
  })
}

function refreshRecon(qc: ReturnType<typeof useQueryClient>, bankId: string) {
  qc.invalidateQueries({ queryKey: ['bank_matches', bankId] })
  qc.invalidateQueries({ queryKey: ['bank_reconciliations'] })
  qc.invalidateQueries({ queryKey: ['bank_lines'] })
  qc.invalidateQueries({ queryKey: ['bank_recon_audit', bankId] })
}

export function useSaveMatch(bankId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankLineIds, journalLineIds, kind }: { bankLineIds: string[]; journalLineIds: string[]; kind: 'auto' | 'manual' }) => {
      const { error } = await supabase.rpc('save_bank_match', { p_bank: bankId, p_bank_lines: bankLineIds, p_journal_lines: journalLineIds, p_kind: kind })
      if (error) throw error
    },
    onSuccess: () => refreshRecon(qc, bankId),
  })
}

export function useUnmatch(bankId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ matchId, reason }: { matchId: string; reason?: string }) => {
      const { error } = await supabase.rpc('unmatch_bank_match', { p_match: matchId, p_reason: reason ?? undefined })
      if (error) throw error
    },
    onSuccess: () => refreshRecon(qc, bankId),
  })
}

/** The "reviewed" ticks of one bank account, as a set of item keys ('bank:<id>', 'book:<table>|<id>', 'match:<id>'). */
export function useReconReviews(bankId: string | null) {
  return useQuery({
    queryKey: ['bank_recon_reviews', bankId],
    enabled: !!bankId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await table('bank_recon_reviews').select('item_key').eq('bank_account_id', bankId as string)
      if (error) throw error
      return new Set(((data ?? []) as { item_key: string }[]).map((r) => r.item_key))
    },
  })
}

export function useToggleReconReview(bankId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemKey, reviewed, userId }: { itemKey: string; reviewed: boolean; userId: string }) => {
      if (reviewed) {
        const { error } = await table('bank_recon_reviews').insert({ bank_account_id: bankId, item_key: itemKey, reviewed_by: userId })
        if (error) throw error
      } else {
        const { error } = await table('bank_recon_reviews').delete().eq('bank_account_id', bankId).eq('item_key', itemKey)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_recon_reviews', bankId] }),
  })
}

export interface ReconLock {
  bank_account_id: string
  locked_until: string
  locked_at: string
  override_until: string | null
  override_reason: string | null
}

export function useReconLock(bankId: string | null) {
  return useQuery({
    queryKey: ['bank_recon_lock', bankId],
    enabled: !!bankId,
    queryFn: async (): Promise<ReconLock | null> => {
      const { data, error } = await table('bank_recon_locks').select('*').eq('bank_account_id', bankId as string).maybeSingle()
      if (error) throw error
      return (data as ReconLock | null) ?? null
    },
  })
}

export function useLockActions(bankId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['bank_recon_lock', bankId] })
    qc.invalidateQueries({ queryKey: ['bank_recon_audit', bankId] })
  }
  return {
    lock: useMutation({
      mutationFn: async (until: string) => {
        const { error } = await supabase.rpc('lock_bank_period', { p_bank: bankId, p_until: until })
        if (error) throw error
      },
      onSuccess: refresh,
    }),
    unlock: useMutation({
      mutationFn: async ({ reason, minutes }: { reason: string; minutes?: number }) => {
        const { error } = await supabase.rpc('unlock_bank_period', { p_bank: bankId, p_reason: reason, p_minutes: minutes ?? 30 })
        if (error) throw error
      },
      onSuccess: refresh,
    }),
    release: useMutation({
      mutationFn: async (reason: string) => {
        const { error } = await supabase.rpc('release_bank_lock', { p_bank: bankId, p_reason: reason })
        if (error) throw error
      },
      onSuccess: refresh,
    }),
  }
}

export interface ReconAuditRow {
  id: string
  at: string
  by_user: string | null
  action: string
  group_ref: string | null
  reason: string | null
  detail: Record<string, unknown> | null
}

export function useReconAudit(bankId: string | null) {
  return useQuery({
    queryKey: ['bank_recon_audit', bankId],
    enabled: !!bankId,
    queryFn: async (): Promise<ReconAuditRow[]> => {
      const { data, error } = await table('bank_recon_audit').select('*').eq('bank_account_id', bankId as string).order('at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as ReconAuditRow[]
    },
  })
}
