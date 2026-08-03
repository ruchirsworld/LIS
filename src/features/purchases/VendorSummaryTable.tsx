import { useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments } from '../../lib/queries/purchases'
import { useExpenses } from '../../lib/queries/expenses'
import { fmt } from '../../lib/calc/format'
import { billTotal, billPaid, billDue } from '../../lib/calc/vendorBills'

export function VendorSummaryTable() {
  const { data: vendors } = useVendors()
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()
  const { data: expenses } = useExpenses(null)
  const [selectedVendorId, setSelectedVendorId] = useState('')

  const relevant = (
    vendors?.filter(
      (v) => bills?.some((b) => b.vendor_id === v.id) || expenses?.some((e) => e.vendor_id === v.id),
    ) ?? []
  ).filter((v) => !selectedVendorId || v.id === selectedVendorId)

  return (
    <details className="toggle-section">
      <summary>Vendor records (consolidated)</summary>

      <div className="field" style={{ maxWidth: 260, marginTop: 16 }}>
        <label>Search vendor</label>
        <SearchableSelect
          items={vendors}
          value={selectedVendorId}
          onChange={setSelectedVendorId}
          getId={(v) => v.id}
          getLabel={(v) => v.name}
          placeholder="— All vendors —"
        />
      </div>

      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Vendor</th>
              <th style={{ textAlign: 'right' }}>Total purchases</th>
              <th style={{ textAlign: 'right' }}>Total paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {relevant.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No vendor purchases yet
                </td>
              </tr>
            )}
            {relevant.map((v) => {
              const vendorBills = bills?.filter((b) => b.vendor_id === v.id) ?? []
              const vendorExpenses = expenses?.filter((e) => e.vendor_id === v.id) ?? []
              const expenseTotal = vendorExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

              const billsPurchases = vendorBills.reduce((s, b) => s + billTotal(b), 0)
              const billsPaid = vendorBills.reduce((s, b) => {
                const billPayments = payments?.filter((p) => p.bill_id === b.id) ?? []
                return s + billPaid(billPayments)
              }, 0)
              const billsDue = vendorBills.reduce((s, b) => {
                const billPayments = payments?.filter((p) => p.bill_id === b.id) ?? []
                return s + billDue(b, billPayments)
              }, 0)

              // Expenses have no due balance — they're recorded already paid,
              // so they add equally to purchases and paid, never to due.
              const totalPurchases = billsPurchases + expenseTotal
              const totalPaid = billsPaid + expenseTotal
              const totalDue = billsDue

              return (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td className="amt">{fmt(totalPurchases)}</td>
                  <td className="amt">{fmt(totalPaid)}</td>
                  <td className="amt">{fmt(totalDue)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
