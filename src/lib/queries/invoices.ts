import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']
type InvoicePaymentInsert = Database['public']['Tables']['invoice_payments']['Insert']
type InvoicePaymentUpdate = Database['public']['Tables']['invoice_payments']['Update']

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type InvoiceNoteRow = Database['public']['Tables']['invoice_notes']['Row']

/** An invoice with the totals of its credit (−) and debit (+) notes folded in,
 * so every calculation that takes an invoice sees what is actually owed. */
export type InvoiceWithNotes = InvoiceRow & {
  adj_amount: number
  adj_gst: number
  adj_tds: number
  adj_retention: number
}

export function useInvoices(range: DateRange | null) {
  return useQuery({
    queryKey: ['invoices', range],
    queryFn: async (): Promise<InvoiceWithNotes[]> => {
      let query = supabase.from('invoices').select('*').order('created_at', { ascending: false })
      if (range?.from) query = query.gte('invoice_date', range.from)
      if (range?.to) query = query.lte('invoice_date', range.to)
      const { data, error } = await query
      if (error) throw error
      const { data: notes, error: notesError } = await supabase.from('invoice_notes').select('*')
      if (notesError) throw notesError
      const totals = new Map<string, { amount: number; gst: number; tds: number; retention: number }>()
      for (const n of (notes ?? []) as InvoiceNoteRow[]) {
        const sign = n.note_type === 'credit' ? -1 : 1
        const t = totals.get(n.invoice_id) ?? { amount: 0, gst: 0, tds: 0, retention: 0 }
        t.amount += sign * Number(n.amount)
        t.gst += sign * Number(n.gst_amount)
        t.tds += sign * Number(n.tds_amount)
        t.retention += sign * Number(n.retention_amount)
        totals.set(n.invoice_id, t)
      }
      return (data ?? []).map((inv) => {
        const t = totals.get(inv.id)
        return { ...inv, adj_amount: t?.amount ?? 0, adj_gst: t?.gst ?? 0, adj_tds: t?.tds ?? 0, adj_retention: t?.retention ?? 0 }
      })
    },
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invoice: InvoiceInsert) => {
      const { data, error } = await supabase.from('invoices').insert(invoice).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: InvoiceUpdate }) => {
      const { error } = await supabase.from('invoices').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

/** Cycles status draft <-> sent, ported 1:1 from the prototype's `cycle` map — stamps invoice_date the first time it becomes 'sent'. */
export function useCycleInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, invoiceDate }: { id: string; status: 'draft' | 'sent'; invoiceDate: string | null }) => {
      const nextStatus = status === 'draft' ? 'sent' : 'draft'
      const nextInvoiceDate = nextStatus === 'sent' && !invoiceDate ? new Date().toISOString().slice(0, 10) : invoiceDate
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: nextStatus, invoice_date: nextInvoiceDate })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

/** Invoices past their due date and still not fully paid — v_invoice_status
 * does the "overdue" date math server-side (see its definition), so no
 * client-side date comparison is needed here. Backs the Dashboard's "Needs
 * attention" drill-down; the headline count/₹ come from v_dashboard_kpis. */
export function useOverdueInvoices() {
  return useQuery({
    queryKey: ['v_invoice_status', 'overdue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_invoice_status')
        .select('*')
        .eq('effective_status', 'overdue')
        .order('effective_due_date')
      if (error) throw error
      return data
    },
  })
}

export function useInvoicePayments() {
  return useQuery({
    queryKey: ['invoice_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_payments').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateInvoicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: InvoicePaymentInsert) => {
      const { data, error } = await supabase.from('invoice_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      // The Dashboard's overdue list reads v_invoice_status.
      qc.invalidateQueries({ queryKey: ['v_invoice_status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateInvoicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: InvoicePaymentUpdate }) => {
      const { data, error } = await supabase.from('invoice_payments').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteInvoicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

type InvoicePaymentRow = Database['public']['Tables']['invoice_payments']['Row']

/** Moves `amount` of excess money off one invoice onto another invoice of the
 * same client — the "adjust extra payment to the next invoice" action. Works
 * newest payment first: a payment that moves in full is simply re-pointed at
 * the target invoice; one that only partly moves is trimmed and its moved
 * share added to the target as a fresh payment (same date, account, mode).
 * Cash and the client's receivable are unchanged overall — only which
 * invoice the money is credited to — so the ledger stays balanced. */
export function useMovePaymentExcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      payments,
      amount,
      targetInvoiceId,
      fromLabel,
    }: {
      payments: InvoicePaymentRow[]
      amount: number
      targetInvoiceId: string
      fromLabel: string
    }) => {
      let remaining = amount
      const newestFirst = [...payments].sort((a, b) => b.date.localeCompare(a.date))
      for (const p of newestFirst) {
        if (remaining <= 0.005) break
        const payAmt = Number(p.amount)
        const take = Math.min(payAmt, remaining)
        if (take >= payAmt - 0.005) {
          const { error } = await supabase
            .from('invoice_payments')
            .update({
              invoice_id: targetInvoiceId,
              reference: [p.reference, `Adjusted from ${fromLabel}`].filter(Boolean).join(' · '),
            })
            .eq('id', p.id)
          if (error) throw error
        } else {
          const { error: trimErr } = await supabase
            .from('invoice_payments')
            .update({ amount: payAmt - take })
            .eq('id', p.id)
          if (trimErr) throw trimErr
          const { error: addErr } = await supabase.from('invoice_payments').insert({
            invoice_id: targetInvoiceId,
            date: p.date,
            amount: take,
            payment_mode: p.payment_mode,
            bank_account_id: p.bank_account_id,
            reference: [p.reference, `Adjusted from ${fromLabel}`].filter(Boolean).join(' · '),
          })
          if (addErr) throw addErr
        }
        remaining -= take
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}
