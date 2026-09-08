import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useVendors } from '../../lib/queries/masters'
import { VendorBillForm } from './VendorBillForm'
import { VendorPaymentForm } from '../vendor/VendorPaymentForm'
import { PaymentRecordsTable } from './PaymentRecordsTable'
import { VendorBillTable } from './VendorBillTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadVendorBillsImportTemplate } from '../../lib/import/vendorBillsTemplate'
import { parseVendorBillsImport, commitVendorBillsImport } from '../../lib/import/runVendorBillsImport'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']
type View = 'bills' | 'payments'

export function PurchasesPage() {
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null)
  const [view, setView] = useState<View>('bills')
  const [paymentVendorId, setPaymentVendorId] = useState('')
  const { profile } = useAuth()
  const { data: vendors } = useVendors()
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'

  return (
    <div className="purchases-page">
      <ModuleHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'nowrap' }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>Procurements</span>
          <div className="cc-switch">
            <button
              type="button"
              className={view === 'bills' ? 'cc-switch-btn active' : 'cc-switch-btn'}
              onClick={() => setView('bills')}
            >
              Bills
            </button>
            <button
              type="button"
              className={view === 'payments' ? 'cc-switch-btn active' : 'cc-switch-btn'}
              onClick={() => setView('payments')}
            >
              Payments
            </button>
          </div>
        </div>
      </ModuleHeader>

      {view === 'bills' ? (
        <>
          <VendorBillForm editingBill={editingBill} onDoneEditing={() => setEditingBill(null)} />
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
        </>
      ) : (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 13 }}>Record a payment</h3>
            <div className="field full" style={{ maxWidth: 320, marginBottom: paymentVendorId ? 16 : 0 }}>
              <label>Vendor</label>
              <SearchableSelect
                items={vendors}
                value={paymentVendorId}
                onChange={setPaymentVendorId}
                getId={(v) => v.id}
                getLabel={(v) => v.name}
                getSearchValue={(v) => `${v.name} ${v.phone ?? ''}`}
                placeholder="— Select vendor —"
              />
            </div>
            {paymentVendorId && <VendorPaymentForm vendorId={paymentVendorId} onDone={() => setPaymentVendorId('')} />}
          </div>
          <PaymentRecordsTable />
        </>
      )}
    </div>
  )
}
