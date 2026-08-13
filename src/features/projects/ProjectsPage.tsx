import { useEffect, useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useProjects, useClients, useVendors } from '../../lib/queries/masters'
import { useUpdateProject } from '../../lib/queries/admin'
import { useExpenses } from '../../lib/queries/expenses'
import { useVendorBills } from '../../lib/queries/purchases'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt, fmtDate } from '../../lib/calc/format'
import { billTotal } from '../../lib/calc/vendorBills'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'
import {
  projectExpenseTotal,
  projectVendorBillTotal,
  projectInvoicedRevenue,
  projectReceivedRevenue,
} from '../../lib/calc/projects'

type Project = Database['public']['Tables']['projects']['Row']

const CLIENT_FILTER_KEY = 'lis.projects.clientFilter'
const SELECTED_PROJECT_KEY = 'lis.projects.selectedId'

export function ProjectsPage() {
  const { profile } = useAuth()
  const canEditStatus = profile?.role === 'admin'
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: expenses } = useExpenses(null)
  const { data: vendorBills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()
  const updateProject = useUpdateProject()

  const activeProjects = projects?.filter((p) => p.status === 'active') ?? []
  // Client/Project picks persist across visits (until the user changes them)
  // rather than resetting to the first project every time this page loads.
  const [clientFilter, setClientFilterState] = useState(() => localStorage.getItem(CLIENT_FILTER_KEY) ?? '')
  const [selectedId, setSelectedIdState] = useState(() => localStorage.getItem(SELECTED_PROJECT_KEY) ?? '')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<'purchases' | 'expenses' | null>(null)
  const selected = projects?.find((p) => p.id === selectedId) ?? activeProjects[0] ?? projects?.[0]

  const visibleProjects = clientFilter ? projects?.filter((p) => p.client_id === clientFilter) : projects

  function setClientFilter(id: string) {
    setClientFilterState(id)
    localStorage.setItem(CLIENT_FILTER_KEY, id)
  }

  function setSelectedId(id: string) {
    setSelectedIdState(id)
    localStorage.setItem(SELECTED_PROJECT_KEY, id)
  }

  function handleClientChange(id: string) {
    setClientFilter(id)
    const proj = projects?.find((p) => p.id === selectedId)
    if (id && proj?.client_id !== id) setSelectedId('')
  }

  useEffect(() => {
    setBreakdown(null)
  }, [selected?.id])

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
  const utilizedPct = budget !== null && budget > 0 ? Math.round((costTotal / budget) * 100) : null

  const projectBillRows = selected ? (vendorBills ?? []).filter((b) => b.project_id === selected.id) : []

  const purchasesByVendorType = new Map<string, number>()
  projectBillRows.forEach((b) => {
    const vendor = vendors?.find((v) => v.id === b.vendor_id)
    const cat = vendor?.category ?? 'Uncategorized'
    purchasesByVendorType.set(cat, (purchasesByVendorType.get(cat) ?? 0) + billTotal(b))
  })

  const projectExpenseRows = selected ? (expenses ?? []).filter((e) => e.project_id === selected.id) : []
  const expensesByPurpose = new Map<string, number>()
  projectExpenseRows.forEach((e) => {
    const key = e.purpose ?? 'Unspecified'
    expensesByPurpose.set(key, (expensesByPurpose.get(key) ?? 0) + Number(e.amount || 0))
  })

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

              <div className="kpi-grid-2col">
                <KpiCard label="Project value" value={selected.value_ex_gst ? fmt(selected.value_ex_gst) : '—'} />
                <KpiCard label="Profit" value={<span style={{ color: 'var(--red)' }}>{fmt(profit)}</span>} />
                <KpiCard label="Invoiced" value={fmt(invoicedRevenue)} />
                <KpiCard label="Due" value={fmt(balanceDue)} />
                <div className="kpi-grid-divider terracotta" />
                <KpiCard label="Budget" value={budget !== null ? fmt(budget) : '—'} />
                <KpiCard label="Utilized" value={utilizedPct !== null ? `${utilizedPct}%` : '—'} />
                <KpiCard
                  label="Purchases"
                  value={fmt(vendorBillTotal)}
                  active={breakdown === 'purchases'}
                  onClick={() => setBreakdown(breakdown === 'purchases' ? null : 'purchases')}
                />
                <KpiCard
                  label="Expenses"
                  value={fmt(expenseTotal)}
                  active={breakdown === 'expenses'}
                  onClick={() => setBreakdown(breakdown === 'expenses' ? null : 'expenses')}
                />
              </div>

              {breakdown === 'purchases' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Purchases by vendor type
                  </div>
                  {purchasesByVendorType.size === 0 ? (
                    <div className="note">No purchases recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(purchasesByVendorType.entries()).map(([cat, amt]) => (
                        <KpiCard key={cat} label={cat} value={fmt(amt)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {breakdown === 'expenses' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Expenses by purpose
                  </div>
                  {expensesByPurpose.size === 0 ? (
                    <div className="note">No expenses recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(expensesByPurpose.entries()).map(([purpose, amt]) => (
                        <KpiCard key={purpose} label={purpose} value={fmt(amt)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
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
