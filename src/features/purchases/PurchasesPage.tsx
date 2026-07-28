import { ModuleHeader } from '../../components/ui'
import { VendorBillForm } from './VendorBillForm'
import { VendorBillTable } from './VendorBillTable'
import { VendorBillQuickPaymentForm } from './VendorBillQuickPaymentForm'
import { VendorSummaryTable } from './VendorSummaryTable'

export function PurchasesPage() {
  return (
    <div>
      <ModuleHeader>Purchases</ModuleHeader>
      <VendorBillForm />
      <VendorBillQuickPaymentForm />
      <VendorSummaryTable />
      <VendorBillTable />
    </div>
  )
}
