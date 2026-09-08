import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { VendorBillForm } from './VendorBillForm'
import { PaymentRecordsTable } from './PaymentRecordsTable'
import { VendorBillTable } from './VendorBillTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadVendorBillsImportTemplate } from '../../lib/import/vendorBillsTemplate'
import { parseVendorBillsImport, commitVendorBillsImport } from '../../lib/import/runVendorBillsImport'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']

export function PurchasesPage() {
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null)
  const { profile } = useAuth()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'

  return (
    <div>
      <ModuleHeader>Procurements</ModuleHeader>
      <VendorBillForm editingBill={editingBill} onDoneEditing={() => setEditingBill(null)} />
      <PaymentRecordsTable />
      <VendorBillTable onEdit={setEditingBill} />

      {canImport && (
        <ImportFileBlock
          label="Bulk-add vendor bills from Excel"
          onDownload={downloadVendorBillsImportTemplate}
          onParse={parseVendorBillsImport}
          onCommit={commitVendorBillsImport}
          invalidateKeys={['vendor_bills']}
        />
      )}
    </div>
  )
}
