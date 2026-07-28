import { useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { useExpenses, useDeleteExpense } from '../../lib/queries/expenses'
import { useProjects, useClients, useVendors } from '../../lib/queries/masters'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/period'
import { ReceiptLink } from '../../components/ReceiptLink'
import { clientLabel } from '../../lib/labels'

export function ExpenseTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: expenses, isLoading } = useExpenses(range)
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const deleteExpense = useDeleteExpense()

  return (
    <details className="toggle-section" open>
      <summary>Expense records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Type</th>
              <th>Project / client</th>
              <th>Cost center</th>
              <th>Location</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Vendor</th>
              <th>Reimb.</th>
              <th>Receipt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!expenses || expenses.length === 0) && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No expenses in this period
                </td>
              </tr>
            )}
            {expenses?.map((e) => {
              const project = projects?.find((p) => p.id === e.project_id)
              const client = project ? clients?.find((c) => c.id === project.client_id) : null
              const projLabel = project ? `${project.name} — ${clientLabel(client)}` : '—'
              const vendor = e.vendor_id ? vendors?.find((v) => v.id === e.vendor_id) : null

              return (
                <tr key={e.id}>
                  <td>{e.display_id ?? '—'}</td>
                  <td>{e.description}</td>
                  <td>{e.type}</td>
                  <td>{projLabel}</td>
                  <td>{e.cost_center ?? '—'}</td>
                  <td>
                    {e.geo_lat != null && e.geo_lng != null ? (
                      <a
                        href={`https://maps.google.com/?q=${e.geo_lat},${e.geo_lng}`}
                        target="_blank"
                        rel="noopener"
                      >
                        📍 view
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="amt">{fmt(e.amount)}</td>
                  <td>{vendor ? vendor.name : '—'}</td>
                  <td>{e.reimbursable ? 'Yes' : 'No'}</td>
                  <td>{e.receipt_path ? <ReceiptLink path={e.receipt_path} /> : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn danger-link"
                      onClick={() => deleteExpense.mutate(e.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
