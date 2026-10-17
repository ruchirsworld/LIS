import { ModuleHeader } from '../../components/ui'
import { InvoiceReceiptForm } from './InvoiceReceiptForm'
import { InvoicePaymentRecordsTable } from './InvoicePaymentRecordsTable'

/** Clients, then Receipts: money received from clients against their invoices, with the form on top and the records below. */
export function ReceiptsPage() {
  return (
    <div>
      <ModuleHeader>Receipts</ModuleHeader>
      <InvoiceReceiptForm />
      <InvoicePaymentRecordsTable />
    </div>
  )
}
