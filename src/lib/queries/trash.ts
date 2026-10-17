import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { toast } from '../feedback'

// Deleting a record moves it to the Trash; it is never removed for good. Only an admin can delete or restore.
export type TrashTable = 'expenses' | 'expense_reimbursements' | 'capital_transactions' | 'transfers' | 'other_receipts' | 'loans' | 'loan_payments'

export const TRASH_TABLE_LABEL: Record<TrashTable, string> = {
  expenses: 'Expense',
  expense_reimbursements: 'Reimbursement',
  capital_transactions: 'Capital',
  transfers: 'Transfer',
  other_receipts: 'Other receipt',
  loans: 'Loan',
  loan_payments: 'Loan payment',
}

/** Moves one record to the Trash. Throws the database's own plain-language message if it cannot (for example, matched in reconciliation).
 * With `qc`, it also shows a toast with Undo, which restores the record. */
export async function trashRecord(table: TrashTable, id: string, options?: { reason?: string; qc?: QueryClient; quiet?: boolean }): Promise<void> {
  const { error } = await supabase.rpc('trash_record', { p_table: table, p_id: id, p_reason: options?.reason ?? null })
  if (error) throw error
  const qc = options?.qc
  if (qc && !options?.quiet) {
    toast('success', 'Moved to the Trash.', {
      action: {
        label: 'Undo',
        onClick: () => {
          restoreRecord(table, id).then(
            () => {
              refreshAfterTrash(qc)
              toast('info', 'Restored.')
            },
            () => toast('error', 'Could not restore. Open the Trash in Additional Settings.')
          )
        },
      },
    })
  }
}

export async function restoreRecord(table: TrashTable, id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_record', { p_table: table, p_id: id })
  if (error) throw error
}

export interface TrashRow {
  table_name: TrashTable
  record_id: string
  display_id: string | null
  record_date: string | null
  amount: number | null
  description: string | null
  deleted_at: string
  deleted_by_name: string | null
  delete_reason: string | null
}

/** Everything may have changed once a record leaves or re-enters the books. */
export function refreshAfterTrash(qc: QueryClient) {
  qc.invalidateQueries()
}

export function useTrash(enabled = true) {
  return useQuery({
    queryKey: ['trash'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_trash')
      if (error) throw error
      return (data ?? []) as unknown as TrashRow[]
    },
  })
}

export function useRestoreRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, id }: { table: TrashTable; id: string }) => restoreRecord(table, id),
    onSuccess: () => refreshAfterTrash(qc),
  })
}
