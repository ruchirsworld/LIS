import { ModuleHeader } from '../../components/ui'
import { LoanForm } from './LoanForm'
import { LoanQuickPaymentForm } from './LoanQuickPaymentForm'
import { LoanTable } from './LoanTable'

export function LoansPage() {
  return (
    <div>
      <ModuleHeader>Loans</ModuleHeader>
      <LoanForm />
      <LoanQuickPaymentForm />
      <LoanTable />
    </div>
  )
}
