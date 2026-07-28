import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type ClientInsert = Database['public']['Tables']['clients']['Insert']
type ClientUpdate = Database['public']['Tables']['clients']['Update']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type CostCenterInsert = Database['public']['Tables']['cost_centers']['Insert']
type PartnerInsert = Database['public']['Tables']['partners']['Insert']
type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
type EmployeeUpdate = Database['public']['Tables']['employees']['Update']
type EmployeeSensitiveInsert = Database['public']['Tables']['employee_sensitive']['Insert']
type EmployeeSensitiveUpdate = Database['public']['Tables']['employee_sensitive']['Update']
type VendorInsert = Database['public']['Tables']['vendors']['Insert']
type VendorUpdate = Database['public']['Tables']['vendors']['Update']
type BankAccountInsert = Database['public']['Tables']['bank_accounts']['Insert']
type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update']

// --- Clients ---

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (client: ClientInsert) => {
      const { data, error } = await supabase.from('clients').insert(client).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ClientUpdate }) => {
      const { error } = await supabase.from('clients').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

// --- Projects ---

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProjectUpdate }) => {
      const { error } = await supabase.from('projects').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

// --- Cost centers ---

export function useCreateCostCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: existing, error: maxErr } = await supabase
        .from('cost_centers')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
      if (maxErr) throw maxErr
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1
      const costCenter: CostCenterInsert = { name, sort_order: nextOrder }
      const { data, error } = await supabase.from('cost_centers').insert(costCenter).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_centers'] }),
  })
}

export function useRenameCostCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('cost_centers').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_centers'] }),
  })
}

export function useDeleteCostCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_centers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_centers'] }),
  })
}

export function useReorderCostCenters() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('cost_centers')
            .update({ sort_order: index + 1 })
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error
            }),
        ),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_centers'] }),
  })
}

// --- CoA: expense categories (admin-only write) + sub-categories
// (create is open to all, ported in lib/queries/expenses.ts; rename/delete are admin-only) ---

export function useCreateExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('expense_categories').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  })
}

export function useRenameExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('expense_categories').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  })
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  })
}

export function useUpdateExpenseCategoryTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('expense_categories').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  })
}

// --- Partners ---

export function useCreatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (partner: PartnerInsert) => {
      const { data, error } = await supabase.from('partners').insert(partner).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useRenamePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('partners').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

export function useDeletePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partners').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })
}

// --- Vendors (insert: admin/cxo; update/delete: admin only — enforced by RLS,
// mirrored in the UI so Staff/CXO don't see controls that would just fail) ---

export function useCreateVendorFull() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vendor: VendorInsert) => {
      const { data, error } = await supabase.from('vendors').insert(vendor).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: VendorUpdate }) => {
      const { error } = await supabase.from('vendors').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useDeleteVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

// --- Bank accounts ---

export function useCreateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (account: BankAccountInsert) => {
      const { data, error } = await supabase.from('bank_accounts').insert(account).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  })
}

export function useUpdateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BankAccountUpdate }) => {
      const { error } = await supabase.from('bank_accounts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  })
}

export function useDeleteBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  })
}

// --- Employees (name/designation/phone/rate live in `employees`; aadhar/pan in
// the admin-only `employee_sensitive` table, per the spec's RLS-restriction decision) ---

export function useEmployeeSensitive() {
  return useQuery({
    queryKey: ['employee_sensitive'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_sensitive').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      employee,
      aadhar,
      pan,
    }: {
      employee: EmployeeInsert
      aadhar: string | null
      pan: string | null
    }) => {
      const { data: created, error } = await supabase.from('employees').insert(employee).select().single()
      if (error) throw error
      if (aadhar || pan) {
        const sensitive: EmployeeSensitiveInsert = { employee_id: created.id, aadhar, pan }
        const { error: sensitiveErr } = await supabase.from('employee_sensitive').insert(sensitive)
        if (sensitiveErr) throw sensitiveErr
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee_sensitive'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      employee,
      aadhar,
      pan,
    }: {
      id: string
      employee: EmployeeUpdate
      aadhar: string | null
      pan: string | null
    }) => {
      const { error } = await supabase.from('employees').update(employee).eq('id', id)
      if (error) throw error

      const sensitive: EmployeeSensitiveUpdate = { aadhar, pan }
      const { error: upsertErr } = await supabase
        .from('employee_sensitive')
        .upsert({ employee_id: id, ...sensitive })
      if (upsertErr) throw upsertErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee_sensitive'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee_sensitive'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    },
  })
}

// --- Users (profiles + admin-create-user Edge Function; no delete-user function exists yet) ---

export interface Profile {
  id: string
  name: string
  role: 'admin' | 'cxo' | 'staff'
  phone: string | null
  employee_id: string | null
  created_at: string
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('name')
      if (error) throw error
      return data as Profile[]
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      phone: string
      pin: string
      name: string
      role: 'admin' | 'cxo' | 'staff'
      employeeId?: string | null
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      role,
      employeeId,
    }: {
      id: string
      name: string
      role: 'admin' | 'cxo' | 'staff'
      employeeId: string | null
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name, role, employee_id: employeeId })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', { body: { id } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
