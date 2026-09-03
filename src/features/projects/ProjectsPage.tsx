import { Fragment, useEffect, useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { ReceiptLink } from '../../components/ReceiptLink'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { VendorBillForm } from '../purchases/VendorBillForm'
import { useProjects, useClients, useVendors, useExpenseSubHeads } from '../../lib/queries/masters'
import { useExpenses } from '../../lib/queries/expenses'
import { useVendorBills } from '../../lib/queries/purchases'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt, fmtDate } from '../../lib/calc/format'
import { billTotal, billGstAmt } from '../../lib/calc/vendorBills'
import { clientLabel } from '../../lib/labels'
import {
  projectExpenseTotal,
  projectVendorBillTotal,
  projectInvoicedRevenue,
  projectReceivedRevenue,
} from '../../lib/calc/projects'

export function ProjectsPage() {
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: expenses } = useExpenses(null)
  const { data: vendorBills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()

  const [clientFilter, setClientFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [breakdown, setBreakdownState] = useState<'purchases' | 'expenses' | null>(null)
  const [purchaseSubHeadId, setPurchaseSubHeadId] = useState<string | null>(null)
  const [expenseSubHeadId, setExpenseSubHeadId] = useState<string | null>(null)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const selected = projects?.find((p) => p.id === selectedId)

  function setBreakdown(next: 'purchases' | 'expenses' | null) {
    setBreakdownState(next)
    setPurchaseSubHeadId(null)
    setExpenseSubHeadId(null)
    setExpandedBillId(null)
    setExpandedExpenseId(null)
    setEditingBillId(null)
    setEditingExpenseId(null)
  }

  const subHeadName = (id: string | null) => (id ? subHeads?.find((s) => s.id === id)?.name : undefined) ?? 'Uncategorized'

  const visibleProjects = clientFilter ? projects?.filter((p) => p.client_id === clientFilter) : projects

  function handleClientChange(id: string) {
    setClientFilter(id)
    const proj = projects?.find((p) => p.id === selectedId)
    if (id && proj?.client_id !== id) setSelectedId('')
  }

  function handleProjectChange(id: string) {
    setSelectedId(id)
    const proj = projects?.find((p) => p.id === id)
    if (proj) setClientFilter(proj.client_id)
  }

  useEffect(() => {
    setBreakdown(null)
  }, [selected?.id])

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

  const purchasesBySubHead = new Map<string, number>()
  projectBillRows.forEach((b) => {
    const key = b.sub_head_id ?? 'none'
    purchasesBySubHead.set(key, (purchasesBySubHead.get(key) ?? 0) + billTotal(b))
  })

  const projectExpenseRows = selected ? (expenses ?? []).filter((e) => e.project_id === selected.id) : []
  const expensesBySubHead = new Map<string, number>()
  projectExpenseRows.forEach((e) => {
    const key = e.sub_head_id ?? 'none'
    expensesBySubHead.set(key, (expensesBySubHead.get(key) ?? 0) + Number(e.amount || 0))
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
                onChange={handleProjectChange}
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
                {clientLabel(client)} · {selected.project_location ?? '—'} · {selected.code ?? selected.display_id ?? '—'} · Started{' '}
                {selected.start_date ? fmtDate(selected.start_date) : '—'}
                {selected.end_date ? ` · Completed ${fmtDate(selected.end_date)}` : ''}
              </div>

              <div className="kpi-grid-2col">
                <KpiCard label="Project value" value={selected.value_ex_gst ? fmt(selected.value_ex_gst) : '—'} />
                <KpiCard label="Profit" value={<span style={{ color: profit < 0 ? 'var(--red)' : 'var(--accent)' }}>{fmt(profit)}</span>} />
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
                    Purchases by sub-head
                  </div>
                  {purchasesBySubHead.size === 0 ? (
                    <div className="note">No purchases recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(purchasesBySubHead.entries()).map(([id, amt]) => (
                        <KpiCard
                          key={id}
                          label={subHeadName(id === 'none' ? null : id)}
                          value={fmt(amt)}
                          active={purchaseSubHeadId === id}
                          onClick={() => setPurchaseSubHeadId(purchaseSubHeadId === id ? null : id)}
                        />
                      ))}
                    </div>
                  )}

                  {purchaseSubHeadId && (
                    <div style={{ marginTop: 16 }}>
                      <div className="note" style={{ marginBottom: 8 }}>
                        ▾ {subHeadName(purchaseSubHeadId === 'none' ? null : purchaseSubHeadId)} — transaction details
                      </div>
                      <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr>
                              <th></th>
                              <th>Date</th>
                              <th>Vendor</th>
                              <th>Description</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectBillRows
                              .filter((b) => (b.sub_head_id ?? 'none') === purchaseSubHeadId)
                              .map((b) => {
                                const vendor = vendors?.find((v) => v.id === b.vendor_id)
                                const isExpanded = expandedBillId === b.id
                                return (
                                  <Fragment key={b.id}>
                                    <tr onClick={() => setExpandedBillId(isExpanded ? null : b.id)} style={{ cursor: 'pointer' }}>
                                      <td>
                                        <button
                                          type="button"
                                          className="row-expand-btn"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setExpandedBillId(isExpanded ? null : b.id)
                                          }}
                                          aria-label={isExpanded ? 'Hide details' : 'Show details'}
                                        >
                                          {isExpanded ? '▾' : '▸'}
                                        </button>
                                      </td>
                                      <td>{b.date ? fmtDate(b.date) : '—'}</td>
                                      <td>{vendor?.name ?? '—'}</td>
                                      <td>{b.description ?? '—'}</td>
                                      <td className="amt">{fmt(billTotal(b))}</td>
                                    </tr>
                                    {isExpanded && editingBillId === b.id && (
                                      <tr className="pay-form-row">
                                        <td colSpan={5}>
                                          <VendorBillForm editingBill={b} onDoneEditing={() => setEditingBillId(null)} />
                                        </td>
                                      </tr>
                                    )}
                                    {isExpanded && editingBillId !== b.id && (
                                      <tr className="pay-form-row">
                                        <td colSpan={5}>
                                          <div className="row-menu-info" style={{ padding: 0, border: 'none' }}>
                                            <div>
                                              <strong>ID:</strong> {b.display_id ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Base amount:</strong> {fmt(b.amount)}
                                            </div>
                                            <div>
                                              <strong>GST:</strong> {fmt(billGstAmt(b))} ({b.gst_pct || 0}%)
                                            </div>
                                            <div>
                                              <strong>Other cost:</strong> {b.other_cost ? fmt(b.other_cost) : '—'}
                                            </div>
                                            {b.qty != null && (
                                              <div>
                                                <strong>Qty × Rate:</strong> {b.qty} × {b.rate != null ? fmt(b.rate) : '—'}
                                              </div>
                                            )}
                                            <div>
                                              <strong>Remarks:</strong> {b.remarks ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Receipt:</strong> {b.receipt_path ? <ReceiptLink path={b.receipt_path} /> : '—'}
                                            </div>
                                          </div>
                                          <button type="button" className="pay-btn" style={{ marginTop: 8 }} onClick={() => setEditingBillId(b.id)}>
                                            Edit
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {breakdown === 'expenses' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Expenses by sub-head
                  </div>
                  {expensesBySubHead.size === 0 ? (
                    <div className="note">No expenses recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(expensesBySubHead.entries()).map(([id, amt]) => (
                        <KpiCard
                          key={id}
                          label={subHeadName(id === 'none' ? null : id)}
                          value={fmt(amt)}
                          active={expenseSubHeadId === id}
                          onClick={() => setExpenseSubHeadId(expenseSubHeadId === id ? null : id)}
                        />
                      ))}
                    </div>
                  )}

                  {expenseSubHeadId && (
                    <div style={{ marginTop: 16 }}>
                      <div className="note" style={{ marginBottom: 8 }}>
                        ▾ {subHeadName(expenseSubHeadId === 'none' ? null : expenseSubHeadId)} — transaction details
                      </div>
                      <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr>
                              <th></th>
                              <th>Date</th>
                              <th>Description</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectExpenseRows
                              .filter((e) => (e.sub_head_id ?? 'none') === expenseSubHeadId)
                              .map((e) => {
                                const vendor = e.vendor_id ? vendors?.find((v) => v.id === e.vendor_id) : null
                                const isExpanded = expandedExpenseId === e.id
                                return (
                                  <Fragment key={e.id}>
                                    <tr onClick={() => setExpandedExpenseId(isExpanded ? null : e.id)} style={{ cursor: 'pointer' }}>
                                      <td>
                                        <button
                                          type="button"
                                          className="row-expand-btn"
                                          onClick={(ev) => {
                                            ev.stopPropagation()
                                            setExpandedExpenseId(isExpanded ? null : e.id)
                                          }}
                                          aria-label={isExpanded ? 'Hide details' : 'Show details'}
                                        >
                                          {isExpanded ? '▾' : '▸'}
                                        </button>
                                      </td>
                                      <td>{e.date ? fmtDate(e.date) : '—'}</td>
                                      <td>{e.description ?? '—'}</td>
                                      <td className="amt">{fmt(e.amount)}</td>
                                    </tr>
                                    {isExpanded && editingExpenseId === e.id && (
                                      <tr className="pay-form-row">
                                        <td colSpan={4}>
                                          <ExpenseForm editingExpense={e} onDoneEditing={() => setEditingExpenseId(null)} />
                                        </td>
                                      </tr>
                                    )}
                                    {isExpanded && editingExpenseId !== e.id && (
                                      <tr className="pay-form-row">
                                        <td colSpan={4}>
                                          <div className="row-menu-info" style={{ padding: 0, border: 'none' }}>
                                            <div>
                                              <strong>ID:</strong> {e.display_id ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Cost center:</strong> {e.cost_center ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Payment mode:</strong> {e.payment_mode ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Vendor:</strong> {vendor?.name ?? '—'}
                                            </div>
                                            {e.qty != null && (
                                              <div>
                                                <strong>Qty × Rate:</strong> {e.qty} {e.unit ?? ''} × {e.rate != null ? fmt(e.rate) : '—'}
                                              </div>
                                            )}
                                            {e.additional_amount ? (
                                              <div>
                                                <strong>Additional amount:</strong> {fmt(e.additional_amount)}
                                              </div>
                                            ) : null}
                                            <div>
                                              <strong>Remarks:</strong> {e.remarks ?? '—'}
                                            </div>
                                            <div>
                                              <strong>Reimbursable:</strong> {e.reimbursable ? 'Yes' : 'No'}
                                            </div>
                                            <div>
                                              <strong>Receipt:</strong> {e.receipt_path ? <ReceiptLink path={e.receipt_path} /> : '—'}
                                            </div>
                                          </div>
                                          <button type="button" className="pay-btn" style={{ marginTop: 8 }} onClick={() => setEditingExpenseId(e.id)}>
                                            Edit
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </details>
          )}
        </>
      )}
    </div>
  )
}
