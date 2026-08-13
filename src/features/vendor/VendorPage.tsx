import { useState } from 'react'
import { ModuleHeader, Button } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { Modal } from '../../components/Modal'
import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments } from '../../lib/queries/purchases'
import { useExpenses } from '../../lib/queries/expenses'
import { fmt } from '../../lib/calc/format'
import { billTotal, billDueRaw } from '../../lib/calc/vendorBills'
import { VendorPaymentForm } from './VendorPaymentForm'
import { VendorPaymentRecordsTable } from './VendorPaymentRecordsTable'

export function VendorPage() {
  const { data: vendors } = useVendors()
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()
  const { data: expenses } = useExpenses(null)

  const [vendorId, setVendorId] = useState('')
  const [showAddPayment, setShowAddPayment] = useState(false)

  const vendorBills = bills?.filter((b) => b.vendor_id === vendorId) ?? []
  const vendorExpenses = expenses?.filter((e) => e.vendor_id === vendorId) ?? []
  const expenseTotal = vendorExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const billsPurchases = vendorBills.reduce((s, b) => s + billTotal(b), 0)
  // Net across all of this vendor's bills, not the sum of each bill's due
  // floored at zero — see VendorBillTable for why that matters.
  const billsDueNet = vendorBills.reduce((s, b) => {
    const billPayments = payments?.filter((p) => p.bill_id === b.id) ?? []
    return s + billDueRaw(b, billPayments)
  }, 0)
  const totalPurchase = billsPurchases + expenseTotal
  const due = Math.max(0, billsDueNet)

  return (
    <div>
      <ModuleHeader>Vendor</ModuleHeader>

      <div className="field full" style={{ maxWidth: 320 }}>
        <label>Select vendor</label>
        <SearchableSelect
          items={vendors}
          value={vendorId}
          onChange={setVendorId}
          getId={(v) => v.id}
          getLabel={(v) => v.name}
          getSearchValue={(v) => `${v.name} ${v.phone ?? ''}`}
          placeholder="— Select vendor —"
        />
      </div>

      {vendorId && (
        <>
          <div className="kpi-grid-2col" style={{ marginTop: 16 }}>
            <div className="dash-card">
              <div className="dash-label">Total purchase</div>
              <div className="dash-value">{fmt(totalPurchase)}</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Due</div>
              <div className="dash-value">{fmt(due)}</div>
            </div>
          </div>

          <Button type="button" onClick={() => setShowAddPayment(true)} style={{ marginBottom: 16 }}>
            Add payment
          </Button>

          {showAddPayment && (
            <Modal title="Add vendor payment" onClose={() => setShowAddPayment(false)}>
              <VendorPaymentForm vendorId={vendorId} onDone={() => setShowAddPayment(false)} />
            </Modal>
          )}

          <VendorPaymentRecordsTable vendorId={vendorId} />
        </>
      )}
    </div>
  )
}
