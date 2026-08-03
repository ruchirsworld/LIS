import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { VendorBillForm } from './VendorBillForm'
import { VendorPaymentForm } from './VendorPaymentForm'
import { PaymentRecordsTable } from './PaymentRecordsTable'
import { VendorBillTable } from './VendorBillTable'
import { VendorSummaryTable } from './VendorSummaryTable'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']

export function PurchasesPage() {
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null)

  return (
    <div>
      <ModuleHeader>Procurements</ModuleHeader>
      <VendorBillForm editingBill={editingBill} onDoneEditing={() => setEditingBill(null)} />
      <VendorPaymentForm />
      <PaymentRecordsTable />
      <VendorSummaryTable />
      <VendorBillTable onEdit={setEditingBill} />
    </div>
  )
}
