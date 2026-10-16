import { ModuleHeader } from '../../components/ui'
import { TransferForm } from './TransferForm'
import { TransferTable } from './TransferTable'
import { AccountBalancesTable } from './AccountBalancesTable'
import { OtherReceiptsSection } from './OtherReceiptsSection'

export function TransfersPage() {
  return (
    <div>
      <ModuleHeader>Transfers</ModuleHeader>
      <TransferForm />
      <TransferTable />
      <OtherReceiptsSection />
      <AccountBalancesTable />
    </div>
  )
}
