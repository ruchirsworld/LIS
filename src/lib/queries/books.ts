import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { selectByIds } from './byIds'
import type { Database, Json } from '../../types/database'

type CompanyProfile = Database['public']['Tables']['company_profile']['Row']
type InvoiceNoteInsert = Database['public']['Tables']['invoice_notes']['Insert']

// ── Company details ──────────────────────────────────────────────────────

/** The business's own name, GSTIN, PAN, address, and the books-locked-until
 * date. One row; readable by everyone signed in, editable by Admin/CXO. */
export function useCompanyProfile() {
  return useQuery({
    queryKey: ['company_profile'],
    queryFn: async (): Promise<CompanyProfile | null> => {
      const { data, error } = await supabase.from('company_profile').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Database['public']['Tables']['company_profile']['Update'] }) => {
      const { data, error } = await supabase
        .from('company_profile')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company_profile'] })
      qc.invalidateQueries({ queryKey: ['books_health'] })
    },
  })
}

// ── Credit / debit notes ─────────────────────────────────────────────────

export function useInvoiceNotes() {
  return useQuery({
    queryKey: ['invoice_notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_notes').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

function invalidateAfterNote(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['invoice_notes'] })
  qc.invalidateQueries({ queryKey: ['invoices'] })
  qc.invalidateQueries({ queryKey: ['v_invoice_status'] })
  qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
  qc.invalidateQueries({ queryKey: ['ledger_lines'] })
  qc.invalidateQueries({ queryKey: ['books_health'] })
}

export function useCreateInvoiceNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Pick<InvoiceNoteInsert, 'invoice_id' | 'note_type' | 'date' | 'amount' | 'reason'>) => {
      const { data, error } = await supabase.from('invoice_notes').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateAfterNote(qc),
  })
}

export function useDeleteInvoiceNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateAfterNote(qc),
  })
}

// ── Books health check ───────────────────────────────────────────────────

export function useBooksHealth() {
  return useQuery({
    queryKey: ['books_health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('books_health_check')
      if (error) throw error
      return data
    },
  })
}

// ── Journal vouchers ─────────────────────────────────────────────────────

export interface JournalVoucherLine {
  id: string
  account_code: string
  account_name: string
  debit: number
  credit: number
}
export interface JournalVoucher {
  id: string
  display_id: string | null
  date: string
  description: string
  lines: JournalVoucherLine[]
}

/** Every manual journal voucher, newest first, with its lines. */
export function useJournalVouchers() {
  return useQuery({
    queryKey: ['journal_vouchers'],
    queryFn: async (): Promise<JournalVoucher[]> => {
      const { data: entries, error } = await supabase
        .from('journal_entries')
        .select('id, display_id, date, description')
        .eq('source_table', 'manual_journal')
        .order('date', { ascending: false })
      if (error) throw error
      if (!entries || entries.length === 0) return []
      const lines = await selectByIds<{ id: string; entry_id: string; debit: number; credit: number; gl_account_id: string }>(
        'journal_lines',
        'id, entry_id, debit, credit, gl_account_id',
        'entry_id',
        entries.map((e) => e.id)
      )
      const { data: accounts, error: accountsError } = await supabase.from('gl_accounts').select('id, code, name')
      if (accountsError) throw accountsError
      const accountById = new Map((accounts ?? []).map((a) => [a.id, a]))
      return entries.map((e) => ({
        id: e.id,
        display_id: e.display_id,
        date: e.date,
        description: e.description,
        lines: (lines ?? [])
          .filter((l) => l.entry_id === e.id)
          .map((l) => ({
            id: l.id,
            account_code: accountById.get(l.gl_account_id)?.code ?? '',
            account_name: accountById.get(l.gl_account_id)?.name ?? '',
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          })),
      }))
    },
  })
}

export function useGlAccounts() {
  return useQuery({
    queryKey: ['gl_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, code, name, account_type').order('code')
      if (error) throw error
      return data
    },
  })
}

export function usePostJournalVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { date: string; narration: string; lines: Json }) => {
      const { data, error } = await supabase.rpc('post_journal_voucher', {
        p_date: v.date,
        p_narration: v.narration,
        p_lines: v.lines,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal_vouchers'] })
      qc.invalidateQueries({ queryKey: ['ledger_lines'] })
      qc.invalidateQueries({ queryKey: ['trial_balance'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      qc.invalidateQueries({ queryKey: ['books_health'] })
    },
  })
}

export function useDeleteJournalVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.rpc('delete_journal_voucher', { p_entry: entryId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal_vouchers'] })
      qc.invalidateQueries({ queryKey: ['ledger_lines'] })
      qc.invalidateQueries({ queryKey: ['trial_balance'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      qc.invalidateQueries({ queryKey: ['books_health'] })
    },
  })
}

/** Re-posts every invoice, receipt and note under the current rules — used
 * after the company GSTIN is entered so past invoices get the GST split. */
export function useRepostAllInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('repost_all_invoices')
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger_lines'] })
      qc.invalidateQueries({ queryKey: ['trial_balance'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      qc.invalidateQueries({ queryKey: ['books_health'] })
    },
  })
}

/** Switches the "GST held until proof of deposit" status on or off for every
 * invoice of one client — used when a client's terms are set or changed. */
export function useSetClientGstHold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, hold }: { clientId: string; hold: boolean }) => {
      const { error } = await supabase.from('invoices').update({ gst_on_hold: hold }).eq('client_id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['v_invoice_status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      qc.invalidateQueries({ queryKey: ['books_health'] })
    },
  })
}

/** Account totals between two dates (null = unbounded) for the financial statements. */
export function useGlBalances(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['gl_balances', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gl_balances', { p_from: from ?? undefined, p_to: to ?? undefined })
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        total_debit: Number(r.total_debit),
        total_credit: Number(r.total_credit),
        sort_order: Number(r.sort_order),
      }))
    },
  })
}

/** Date of the earliest ledger entry — where the financial-year list starts. */
export function useFirstEntryDate() {
  return useQuery({
    queryKey: ['first_entry_date'],
    queryFn: async () => {
      const { data, error } = await supabase.from('journal_entries').select('date').order('date').limit(1).maybeSingle()
      if (error) throw error
      return data?.date ?? null
    },
  })
}

// ── Bank reconciliation ──────────────────────────────────────────────────

export interface BankLineRow {
  id: string
  date: string
  description: string
  deposit: number
  withdrawal: number
  sourceTable: string | null
  sourceId: string | null
}

/** Every ledger line posted to one bank account, oldest first. */
export function useBankLines(bankAccountId: string | null) {
  return useQuery({
    queryKey: ['bank_lines', bankAccountId],
    enabled: !!bankAccountId,
    queryFn: async (): Promise<BankLineRow[]> => {
      const { data: account, error: accountError } = await supabase.from('gl_accounts').select('id').eq('code', '1020').single()
      if (accountError) throw accountError
      const { data, error } = await supabase
        .from('journal_lines')
        .select('id, debit, credit, journal_entries!inner(date, description, source_table, source_id)')
        .eq('gl_account_id', account.id)
        .eq('bank_account_id', bankAccountId as string)
      if (error) throw error
      return (data ?? [])
        .map((row) => {
          type Entry = { date: string; description: string; source_table: string | null; source_id: string | null }
          const entry = row.journal_entries as unknown as Entry | Entry[]
          const e = Array.isArray(entry) ? entry[0] : entry
          return {
            id: row.id,
            date: e?.date ?? '',
            description: e?.description ?? '',
            deposit: Number(row.debit || 0),
            withdrawal: Number(row.credit || 0),
            sourceTable: e?.source_table ?? null,
            sourceId: e?.source_id ?? null,
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    },
  })
}

/** The ledger lines of a bank account already ticked off against a statement. */
export function useClearedBankLines(bankAccountId: string | null) {
  return useQuery({
    queryKey: ['bank_reconciliations', bankAccountId],
    enabled: !!bankAccountId,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.from('bank_reconciliations').select('journal_line_id, cleared_on').eq('bank_account_id', bankAccountId as string)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.journal_line_id, r.cleared_on]))
    },
  })
}

export function useSetBankLineCleared(bankAccountId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lineIds, cleared, clearedOn }: { lineIds: string[]; cleared: boolean; clearedOn: string }) => {
      if (!bankAccountId || lineIds.length === 0) return
      if (cleared) {
        const { error } = await supabase
          .from('bank_reconciliations')
          .upsert(lineIds.map((id) => ({ journal_line_id: id, bank_account_id: bankAccountId, cleared_on: clearedOn })), { onConflict: 'journal_line_id' })
        if (error) throw error
      } else {
        const { error } = await supabase.from('bank_reconciliations').delete().in('journal_line_id', lineIds)
        if (error) throw error
      }
    },
    meta: { quiet: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_reconciliations', bankAccountId] }),
  })
}

