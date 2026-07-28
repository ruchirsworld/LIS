import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments } from '../../lib/queries/purchases'
import { billTotal, billPaid, billDue } from '../../lib/calc/vendorBills'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function VendorReport({ range }: { range: DateRange | null }) {
  const { data: vendors } = useVendors()
  const { data: bills } = useVendorBills(null)
  const { data: payments } = useVendorBillPayments()

  const relevantVendors = vendors?.filter((v) => bills?.some((b) => b.vendor_id === v.id)) ?? []

  const rows = relevantVendors.map((v) => {
    const vendorBills = bills?.filter((b) => b.vendor_id === v.id) ?? []
    const periodBills = vendorBills.filter((b) => inRange(b.date, range?.from ?? null, range?.to ?? null))
    const purchasesThisPeriod = periodBills.reduce((s, b) => s + billTotal(b), 0)

    const billIds = new Set(vendorBills.map((b) => b.id))
    const vendorPayments = payments?.filter((p) => billIds.has(p.bill_id)) ?? []
    const periodPayments = vendorPayments.filter((p) => inRange(p.date, range?.from ?? null, range?.to ?? null))
    const paidThisPeriod = billPaid(periodPayments)

    const dueToDate = vendorBills.reduce((s, b) => {
      const billPayments = vendorPayments.filter((p) => p.bill_id === b.id)
      return s + billDue(b, billPayments)
    }, 0)

    return { id: v.id, name: v.name, purchasesThisPeriod, paidThisPeriod, dueToDate }
  })

  const sections: ExportSection[] = [
    {
      title: 'Vendor report',
      columns: ['Vendor', 'Purchases (period)', 'Paid (period)', 'Due (to date)'],
      rows: rows.map((r) => [r.name, r.purchasesThisPeriod, r.paidThisPeriod, r.dueToDate]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Vendor report</summary>
      <ReportExportButtons title="Vendor report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Vendor</th>
              <th style={{ textAlign: 'right' }}>Purchases (period)</th>
              <th style={{ textAlign: 'right' }}>Paid (period)</th>
              <th style={{ textAlign: 'right' }}>Due (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No vendor bills yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="amt">{fmt(r.purchasesThisPeriod)}</td>
                <td className="amt">{fmt(r.paidThisPeriod)}</td>
                <td className="amt">{fmt(r.dueToDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
