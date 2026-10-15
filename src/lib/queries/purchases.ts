import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { DateRange } from '../calc/period'
import type { Database } from '../../types/database'

type VendorBillInsert = Database['public']['Tables']['vendor_bills']['Insert']
type VendorBillUpdate = Database['public']['Tables']['vendor_bills']['Update']
type VendorBillPaymentInsert = Database['public']['Tables']['vendor_bill_payments']['Insert']
type VendorBillPaymentUpdate = Database['public']['Tables']['vendor_bill_payments']['Update']

export function useVendorBills(range: DateRange | null) {
  return useQuery({
    queryKey: ['vendor_bills', range],
    queryFn: async () => {
      let query = supabase.from('vendor_bills').select('*').order('date', { ascending: false })
      if (range?.from) query = query.gte('date', range.from)
      if (range?.to) query = query.lte('date', range.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bill: VendorBillInsert) => {
      const { data, error } = await supabase.from('vendor_bills').insert(bill).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bills'] })
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['vendor_advances'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: VendorBillUpdate }) => {
      const { data, error } = await supabase.from('vendor_bills').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bills'] })
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['vendor_advances'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteVendorBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendor_bills').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bills'] })
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['vendor_advances'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

/** What has already been paid or set off against a bill. An advance held for the vendor is set against a new bill the moment it is saved. */
export async function fetchBillPaid(billId: string): Promise<number> {
  const { data, error } = await supabase.from('vendor_bill_payments').select('amount').eq('bill_id', billId)
  if (error) throw error
  return (data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function useVendorBillPayments() {
  return useQuery({
    queryKey: ['vendor_bill_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_bill_payments').select('*').order('date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateVendorBillPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: VendorBillPaymentInsert) => {
      const { data, error } = await supabase.from('vendor_bill_payments').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateVendorBillPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: VendorBillPaymentUpdate }) => {
      const { data, error } = await supabase.from('vendor_bill_payments').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteVendorBillPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendor_bill_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

type VendorAdvanceInsert = Database['public']['Tables']['vendor_advances']['Insert']

// An advance changes the books (cash or bank, the advances account) and, through the database, which
// bills are settled, so everything that reads those has to refetch.
function invalidateAfterAdvance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['vendor_advances'] })
  qc.invalidateQueries({ queryKey: ['vendor_bill_payments'] })
  qc.invalidateQueries({ queryKey: ['bank_lines'] })
  qc.invalidateQueries({ queryKey: ['ledger_lines'] })
  qc.invalidateQueries({ queryKey: ['gl_balances'] })
  qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
}

export function useVendorAdvances() {
  return useQuery({
    queryKey: ['vendor_advances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_advances').select('*').order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateVendorAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: VendorAdvanceInsert) => {
      const { data, error } = await supabase.from('vendor_advances').insert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateAfterAdvance(qc),
  })
}

export function useDeleteVendorAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendor_advances').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateAfterAdvance(qc),
  })
}
