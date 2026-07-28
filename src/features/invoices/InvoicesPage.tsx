import { ModuleHeader } from '../../components/ui'
import { InvoiceForm } from './InvoiceForm'
import { InvoiceReceiptForm } from './InvoiceReceiptForm'
import { InvoiceTable } from './InvoiceTable'
import { ClientSummaryTable } from './ClientSummaryTable'
import { ProjectSummaryTable } from './ProjectSummaryTable'

export function InvoicesPage() {
  return (
    <div>
      <ModuleHeader>Invoices</ModuleHeader>
      <InvoiceForm />
      <InvoiceReceiptForm />
      <InvoiceTable />
      <ClientSummaryTable />
      <ProjectSummaryTable />
    </div>
  )
}
