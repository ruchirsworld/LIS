import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type ClientInsert = Database['public']['Tables']['clients']['Insert']
type ClientUpdate = Database['public']['Tables']['clients']['Update']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectUpdate = Database['public']['Tables']['projects']['Update']
type CostCenterInsert = Database['public']['Tables']['cost_centers']['Insert']
type VendorInsert = Database['public']['Tables']['vendors']['Insert']
type VendorUpdate = Database['public']['Tables']['vendors']['Update']
type BankAccountInsert = Database['public']['Tables']['bank_accounts']['Insert']
type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update']
type StaffInsert = Database['public']['Tables']['staff']['Insert']
type StaffUpdate = Database['public']['Tables']['staff']['Update']

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

export function useUpdateCostCenterTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('cost_centers').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_centers'] }),
  })
}

// --- Expense sub-heads (Chart of Accounts: Major Head is a fixed set of 10,
// Sub-Head is addable within a head — code is "<major_head_code>.<n>") ---

export function useCreateExpenseSubHead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ majorHeadCode, majorHead, name }: { majorHeadCode: number; majorHead: string; name: string }) => {
      const { data: existing, error: maxErr } = await supabase
        .from('expense_sub_heads')
        .select('sort_order')
        .eq('major_head_code', majorHeadCode)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (maxErr) throw maxErr
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1
      const code = `${majorHeadCode}.${nextOrder}`
      const { data, error } = await supabase
        .from('expense_sub_heads')
        .insert({ major_head_code: majorHeadCode, major_head: majorHead, code, name, sort_order: nextOrder })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_sub_heads'] }),
  })
}

export function useRenameExpenseSubHead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('expense_sub_heads').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_sub_heads'] }),
  })
}

export function useDeleteExpenseSubHead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_sub_heads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_sub_heads'] }),
  })
}

export function useUpdateExpenseSubHeadTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('expense_sub_heads').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_sub_heads'] }),
  })
}

// --- Expense units (Qty x Rate breakdown's unit-of-measure — open insert,
// mirrors expense_types' inline "+ Add new" pattern) ---

export function useCreateExpenseUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('expense_units').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_units'] }),
  })
}

export function useDeleteExpenseUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_units').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_units'] }),
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

// --- Staff (insert: admin/cxo; update/delete: admin only — enforced by RLS,
// mirrored in the UI so Staff/CXO don't see controls that would just fail) ---

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (staff: StaffInsert) => {
      const { data, error } = await supabase.from('staff').insert(staff).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: StaffUpdate }) => {
      const { error } = await supabase.from('staff').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
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

// --- Users (profiles + admin-create-user Edge Function; no delete-user function exists yet) ---

export interface Profile {
  id: string
  name: string
  role: 'admin' | 'cxo' | 'supervisor'
  phone: string | null
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
      role: 'admin' | 'cxo' | 'supervisor'
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
    }: {
      id: string
      name: string
      role: 'admin' | 'cxo' | 'supervisor'
    }) => {
      const { error } = await supabase.from('profiles').update({ name, role }).eq('id', id)
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

// --- Supervisor project assignments ---
// A Supervisor can be responsible for more than one project at once (e.g.
// covering two nearby sites) — this join table is separate from a field
// worker's single default_project_id in `staff`.

export interface SupervisorProjectRow {
  id: string
  profile_id: string
  project_id: string
}

export function useSupervisorProjects(profileId: string | null) {
  return useQuery({
    queryKey: ['supervisor-projects', profileId],
    queryFn: async () => {
      if (!profileId) return []
      const { data, error } = await supabase.from('supervisor_projects').select('*').eq('profile_id', profileId)
      if (error) throw error
      return data as SupervisorProjectRow[]
    },
    enabled: !!profileId,
  })
}

export function useSetSupervisorProjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, projectIds }: { profileId: string; projectIds: string[] }) => {
      const { error: delError } = await supabase.from('supervisor_projects').delete().eq('profile_id', profileId)
      if (delError) throw delError
      if (projectIds.length > 0) {
        const { error: insError } = await supabase
          .from('supervisor_projects')
          .insert(projectIds.map((project_id) => ({ profile_id: profileId, project_id })))
        if (insError) throw insError
      }
    },
    onSuccess: (_data, { profileId }) => {
      qc.invalidateQueries({ queryKey: ['supervisor-projects', profileId] })
    },
  })
}
