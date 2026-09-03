import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

// Read-only lists for admin-tier "master data" reused across many tabs
// (dropdowns on Expenses, Invoices, Vendor Bills, Team Tracker, Capital, etc.)

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCostCenters() {
  return useQuery({
    queryKey: ['cost_centers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_centers').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

/** Chart of Accounts: the Major Head / Sub-Head taxonomy shared by Payments
 * (expenses) and Procurements (vendor_bills) — replaces expense_purposes
 * (which only ever applied to the Projects cost center) as the categorization
 * dimension for both modules. */
export function useExpenseSubHeads() {
  return useQuery({
    queryKey: ['expense_sub_heads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_sub_heads').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useExpenseUnits() {
  return useQuery({
    queryKey: ['expense_units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_units').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}
