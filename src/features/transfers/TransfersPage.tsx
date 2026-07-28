import { ModuleHeader } from '../../components/ui'
import { TransferForm } from './TransferForm'
import { TransferTable } from './TransferTable'
import { AccountBalancesTable } from './AccountBalancesTable'

export function TransfersPage() {
  return (
    <div>
      <ModuleHeader>Transfers</ModuleHeader>
      <TransferForm />
      <TransferTable />
      <AccountBalancesTable />
    </div>
  )
}
