import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { InvoiceForm } from './InvoiceForm'
import { InvoiceReceiptForm } from './InvoiceReceiptForm'
import { InvoicePaymentRecordsTable } from './InvoicePaymentRecordsTable'
import { InvoiceTable } from './InvoiceTable'
import { ClientSummaryTable } from './ClientSummaryTable'
import { ProjectSummaryTable } from './ProjectSummaryTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadInvoicesAndReceiptsImportTemplate } from '../../lib/import/invoicesAndReceiptsTemplate'
import { parseInvoicesAndReceiptsImport, commitInvoicesAndReceiptsImport } from '../../lib/import/runInvoicesAndReceiptsImport'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

export function InvoicesPage() {
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const { profile } = useAuth()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'

  return (
    <div>
      <ModuleHeader>Invoices</ModuleHeader>
      <InvoiceForm editingInvoice={editingInvoice} onDoneEditing={() => setEditingInvoice(null)} />
      <InvoiceReceiptForm />
      <InvoicePaymentRecordsTable />
      <InvoiceTable onEdit={setEditingInvoice} />
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
