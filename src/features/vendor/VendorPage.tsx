import { ModuleHeader } from '../../components/ui'
import { VendorPaymentForm } from './VendorPaymentForm'
import { VendorSummaryTable } from './VendorSummaryTable'

export function VendorPage() {
  return (
    <div>
      <ModuleHeader>Vendor</ModuleHeader>
      <VendorPaymentForm />
      <VendorSummaryTable />
    </div>
  )
}
