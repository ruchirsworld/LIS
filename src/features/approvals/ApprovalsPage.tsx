import { ModuleHeader } from '../../components/ui'
import { PendingClaimApprovals } from '../expenses/PendingClaimApprovals'

// Admin/CXO's approval inbox — a Supervisor's own Project expense claims
// sit here until reviewed. Not a real record (or posted to the GL) until
// approved here.
export function ApprovalsPage() {
  return (
    <div>
      <ModuleHeader>Approvals</ModuleHeader>
      <PendingClaimApprovals />
    </div>
  )
}
