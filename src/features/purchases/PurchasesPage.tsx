import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { VendorBillForm } from './VendorBillForm'
import { PaymentRecordsTable } from './PaymentRecordsTable'
import { VendorBillTable } from './VendorBillTable'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']

export function PurchasesPage() {
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null)

  return (
    <div>
      <ModuleHeader>Procurements</ModuleHeader>
      <VendorBillForm editingBill={editingBill} onDoneEditing={() => setEditingBill(null)} />
      <PaymentRecordsTable />
      <VendorBillTable onEdit={setEditingBill} />
    </div>
  )
}
