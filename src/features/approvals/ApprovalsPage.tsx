import { ModuleHeader } from '../../components/ui'
import { PendingExpenseApprovals } from '../expenses/PendingExpenseApprovals'

// Admin/CXO's approval inbox — a Supervisor's own Project expense claims
// and field-worker claims from LIS_Fields both sit in one table until
// reviewed. Neither becomes a real record (or posts to the GL) until
// approved here.
export function ApprovalsPage() {
  return (
    <div>
      <ModuleHeader>Approvals</ModuleHeader>
      <PendingExpenseApprovals />
    </div>
  )
}
