import { useExpenses, usePendingFieldExpenses } from './expenses'

/** Total items waiting on an Admin/CXO's review — a Supervisor's own
 * pending Project expense claims plus field-worker claims submitted from
 * LIS_Fields. Drives the Approvals nav badge; keep in sync with whatever
 * ApprovalsPage actually renders. `enabled` should be false for a
 * Supervisor — they can't approve anything, so there's no reason to run
 * either query (or hit the field-expenses-bridge edge function) for them. */
export function usePendingApprovalsCount(enabled = true) {
  const { data: pendingSupervisorExpenses } = useExpenses(null, 'pending', enabled)
  const { data: pendingFieldExpenses } = usePendingFieldExpenses(enabled)

  const supervisorCount = (pendingSupervisorExpenses ?? []).filter((e) => e.cost_center === 'Project').length
  const fieldCount = (pendingFieldExpenses ?? []).length
  return supervisorCount + fieldCount
}
