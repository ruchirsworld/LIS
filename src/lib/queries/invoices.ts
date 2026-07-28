import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
type InvoicePaymentInsert = Database['public']['Tables']['invoice_payments']['Insert']

export function useInvoices(range: DateRange | null) {
  return useQuery({
    queryKey: ['invoices', range],
    queryFn: async () => {
      let query = supabase.from('invoices').select('*').order('created_at', { ascending: false })
      if (range?.from) query = query.gte('invoice_date', range.from)
      if (range?.to) query = query.lte('invoice_date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
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
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}
