import { ModuleHeader } from '../../components/ui'
import { LoanForm } from './LoanForm'
import { LoanTable } from './LoanTable'

export function LoansPage() {
  return (
    <div>
      <ModuleHeader>Loans</ModuleHeader>
      <LoanForm editingLoan={null} onDoneEditing={() => {}} />
      <LoanTable />
    </div>
  )
}
