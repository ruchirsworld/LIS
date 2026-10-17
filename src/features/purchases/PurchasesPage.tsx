import { ModuleHeader } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { VendorBillForm } from './VendorBillForm'
import { PaymentRecordsTable } from './PaymentRecordsTable'
import { VendorAdvanceSection } from './VendorAdvanceSection'
import { VendorBillTable } from './VendorBillTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadVendorBillsImportTemplate } from '../../lib/import/vendorBillsTemplate'
import { parseVendorBillsImport, commitVendorBillsImport } from '../../lib/import/runVendorBillsImport'

export function PurchasesPage() {
  const { profile } = useAuth()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'

  return (
    <div>
      <ModuleHeader>Procurements</ModuleHeader>
      <VendorBillForm editingBill={null} onDoneEditing={() => {}} />
      <VendorAdvanceSection />
      <PaymentRecordsTable />
      <VendorBillTable />

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
