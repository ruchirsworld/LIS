import { useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useProjects, useClients } from '../../lib/queries/masters'
import { useUpdateProject } from '../../lib/queries/admin'
import { useExpenses } from '../../lib/queries/expenses'
import { useVendorBills } from '../../lib/queries/purchases'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt, fmtDate } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'
import {
  projectExpenseTotal,
  projectVendorBillTotal,
  projectInvoicedRevenue,
  projectReceivedRevenue,
} from '../../lib/calc/projects'

type Project = Database['public']['Tables']['projects']['Row']

export function ProjectsPage() {
  const { profile } = useAuth()
  const canEditStatus = profile?.role === 'admin'
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: expenses } = useExpenses(null)
  const { data: vendorBills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()
  const updateProject = useUpdateProject()

  const activeProjects = projects?.filter((p) => p.status === 'active') ?? []
  const [clientFilter, setClientFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const selected = projects?.find((p) => p.id === selectedId) ?? activeProjects[0] ?? projects?.[0]

  const visibleProjects = clientFilter ? projects?.filter((p) => p.client_id === clientFilter) : projects

  function handleClientChange(id: string) {
    setClientFilter(id)
    const proj = projects?.find((p) => p.id === selectedId)
    if (id && proj?.client_id !== id) setSelectedId('')
  }

  async function handleToggleStatus(p: Project) {
    const nextStatus = p.status === 'completed' ? 'active' : 'completed'
    // End date is auto-set the day a project is marked Completed here, and
    // cleared if it's switched back to Active — never hand-edited in Admin.
    const nextEndDate = nextStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null
    setUpdatingId(p.id)
    try {
      await updateProject.mutateAsync({ id: p.id, patch: { status: nextStatus, end_date: nextEndDate } })
    } finally {
      setUpdatingId(null)
    }
  }

  const client = selected ? clients?.find((c) => c.id === selected.client_id) : undefined
  const expenseTotal = selected ? projectExpenseTotal(selected.id, expenses ?? []) : 0
  const vendorBillTotal = selected ? projectVendorBillTotal(selected.id, vendorBills ?? []) : 0
  const costTotal = expenseTotal + vendorBillTotal
  const invoicedRevenue = selected ? projectInvoicedRevenue(selected.id, invoices ?? []) : 0
  const receivedRevenue = selected ? projectReceivedRevenue(selected.id, invoices ?? [], invoicePayments ?? []) : 0
  const balanceDue = invoicedRevenue - receivedRevenue
  const profit = invoicedRevenue - costTotal
  const budget = selected?.budget ?? null
  const budgetRemaining = budget !== null ? budget - costTotal : null

  return (
    <div>
      <ModuleHeader>Projects</ModuleHeader>

      {!projects || projects.length === 0 ? (
        <div className="note">No projects yet — add one under Admin → Projects.</div>
      ) : (
        <>
          <div className="form-row">
            <div className="field">
              <label>Client</label>
              <SearchableSelect
                items={clients}
                value={clientFilter}
                onChange={handleClientChange}
                getId={(c) => c.id}
                getLabel={(c) => clientLabel(c)}
                placeholder="— All clients —"
              />
            </div>
            <div className="field">
              <label>Project</label>
              <SearchableSelect
                items={visibleProjects}
                value={selected?.id ?? ''}
                onChange={setSelectedId}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder="— Select project —"
              />
            </div>
          </div>

          {selected && (
            <details className="toggle-section" open>
              <summary>{selected.name}</summary>
              <div className="note" style={{ marginTop: 16, marginBottom: 12 }}>
                {clientLabel(client)} · {selected.project_location ?? '—'} · {selected.display_id ?? '—'} · Started{' '}
                {selected.start_date ? fmtDate(selected.start_date) : '—'}
                {selected.end_date ? ` · Completed ${fmtDate(selected.end_date)}` : ''}
              </div>

              <div className="dash-grid">
                <KpiCard label="Contract value" value={selected.value_ex_gst ? fmt(selected.value_ex_gst) : '—'} />
                <KpiCard label="Budget" value={budget !== null ? fmt(budget) : '—'} />
                <KpiCard label="Total expenses incurred" value={fmt(expenseTotal)} />
                <KpiCard label="Budget remaining" value={budgetRemaining !== null ? fmt(budgetRemaining) : '—'} />
                <KpiCard label="Total purchases" value={fmt(vendorBillTotal)} />
                <KpiCard label="Total invoice raised" value={fmt(invoicedRevenue)} />
                <KpiCard label="Amount received" value={fmt(receivedRevenue)} />
                <KpiCard label="Balance amount due" value={fmt(balanceDue)} />
                <KpiCard label="Project profit" value={fmt(profit)} />
              </div>
            </details>
          )}

          <details className="toggle-section" open style={{ marginTop: 18 }}>
            <summary>All projects</summary>
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const rowClient = clients?.find((c) => c.id === p.client_id)
                    return (
                      <tr
                        key={p.id}
                        className={selected?.id === p.id ? 'row-selected' : ''}
                        onClick={() => setSelectedId(p.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{p.display_id ?? '—'}</td>
                        <td>{p.name}</td>
                        <td>{clientLabel(rowClient)}</td>
                        <td>{p.start_date ? fmtDate(p.start_date) : '—'}</td>
                        <td>{p.end_date ? fmtDate(p.end_date) : '—'}</td>
                        <td>
                          {canEditStatus ? (
                            <label className="status-switch" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={p.status === 'completed'}
                                disabled={updatingId === p.id}
                                onChange={() => handleToggleStatus(p)}
                              />
                              <span className="status-switch-track" />
                              <span className="status-switch-label">
                                {p.status === 'completed' ? 'Completed' : 'Active'}
                              </span>
                            </label>
                          ) : (
                            p.status
                          )}
                        </td>
                        <td className="amt">{p.budget ? fmt(p.budget) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
