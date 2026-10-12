import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
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
      const { data: lines, error: linesError } = await supabase
        .from('journal_lines')
        .select('id, entry_id, debit, credit, gl_account_id')
        .in(
          'entry_id',
          entries.map((e) => e.id)
        )
      if (linesError) throw linesError
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
