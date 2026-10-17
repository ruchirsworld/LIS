import { ModuleHeader } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { InvoiceForm } from './InvoiceForm'
import { InvoiceTable } from './InvoiceTable'
import { ClientSummaryTable } from './ClientSummaryTable'
import { ProjectSummaryTable } from './ProjectSummaryTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadInvoicesAndReceiptsImportTemplate } from '../../lib/import/invoicesAndReceiptsTemplate'
import { parseInvoicesAndReceiptsImport, commitInvoicesAndReceiptsImport } from '../../lib/import/runInvoicesAndReceiptsImport'


export function InvoicesPage() {
  const { profile } = useAuth()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'

  return (
    <div>
      <ModuleHeader>Invoices</ModuleHeader>
      <InvoiceForm editingInvoice={null} onDoneEditing={() => {}} />
      <InvoiceTable />
      <ClientSummaryTable />
      <ProjectSummaryTable />

      {canImport && (
        <ImportFileBlock
          label="Bulk-add invoices & receipts from Excel"
          onDownload={downloadInvoicesAndReceiptsImportTemplate}
          onParse={parseInvoicesAndReceiptsImport}
          onCommit={commitInvoicesAndReceiptsImport}
          invalidateKeys={['invoices', 'invoice_payments']}
        />
      )}
    </div>
  )
}
