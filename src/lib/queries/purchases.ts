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
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
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
