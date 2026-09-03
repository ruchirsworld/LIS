import { useExpenses } from './expenses'

/** Total items waiting on an Admin/CXO's review — a Supervisor's own
 * pending Project expense claims. Drives the Approvals nav badge; keep in
 * sync with whatever ApprovalsPage actually renders. `enabled` should be
 * false for a Supervisor — they can't approve anything, so there's no
 * reason to run this query for them. */
export function usePendingApprovalsCount(enabled = true) {
  const { data: pendingSupervisorExpenses } = useExpenses(null, 'pending', enabled)
  return (pendingSupervisorExpenses ?? []).filter((e) => e.cost_center === 'Project').length
}
