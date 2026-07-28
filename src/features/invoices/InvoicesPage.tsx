import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { InvoiceForm } from './InvoiceForm'
import { InvoiceReceiptForm } from './InvoiceReceiptForm'
import { InvoiceTable } from './InvoiceTable'
import { ClientSummaryTable } from './ClientSummaryTable'
import { ProjectSummaryTable } from './ProjectSummaryTable'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

export function InvoicesPage() {
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)

  return (
    <div>
      <ModuleHeader>Invoices</ModuleHeader>
      <InvoiceForm editingInvoice={editingInvoice} onDoneEditing={() => setEditingInvoice(null)} />
      <InvoiceReceiptForm />
      <InvoiceTable onEdit={setEditingInvoice} />
      <ClientSummaryTable />
      <ProjectSummaryTable />
    </div>
  )
}
