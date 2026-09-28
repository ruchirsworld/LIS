import { Fragment, useEffect, useState } from 'react'
import { ModuleHeader, KpiCard } from '../../components/ui'
import { SearchableSelect } from '../../components/SearchableSelect'
import { ReceiptLink } from '../../components/ReceiptLink'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { VendorBillForm } from '../purchases/VendorBillForm'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useProjects, useClients, useVendors, useExpenseSubHeads, useStaff } from '../../lib/queries/masters'
import { useExpenses } from '../../lib/queries/expenses'
import { useVendorBills } from '../../lib/queries/purchases'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { useAllStaffAttendance, useAllStaffProjectAssignments } from '../../lib/queries/teamTracking'
import { useHolidays } from '../../lib/queries/hr'
import { useTrips } from '../../lib/queries/trips'
import { fmt, fmtDate } from '../../lib/calc/format'
import { billTotal, billGstAmt } from '../../lib/calc/vendorBills'
import { clientLabel } from '../../lib/labels'
import {
  projectExpenseTotal,
  projectVendorBillTotal,
  projectInvoicedRevenueExGst,
  projectReceivedRevenue,
  projectWageByStaff,
} from '../../lib/calc/projects'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ProjectsPage() {
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: expenses } = useExpenses(null)
  const { data: pendingExpenses } = useExpenses(null, 'pending')
  const { data: vendorBills } = useVendorBills(null)
  const { data: invoices } = useInvoices(null)
  const { data: invoicePayments } = useInvoicePayments()
  const { data: staff } = useStaff()
  const { data: staffAttendance } = useAllStaffAttendance()
  const { data: staffAssignments } = useAllStaffProjectAssignments()
  const { data: holidays } = useHolidays()
  const { data: trips } = useTrips()

  const [clientFilter, setClientFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [breakdown, setBreakdownState] = useState<'purchases' | 'directExpenses' | 'tripExpenses' | 'salaries' | null>(null)
  const [purchaseSubHeadId, setPurchaseSubHeadId] = useState<string | null>(null)
  const [directExpenseSubHeadId, setDirectExpenseSubHeadId] = useState<string | null>(null)
  const [tripExpenseSubHeadId, setTripExpenseSubHeadId] = useState<string | null>(null)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const selected = projects?.find((p) => p.id === selectedId)

  function setBreakdown(next: 'purchases' | 'directExpenses' | 'tripExpenses' | 'salaries' | null) {
    setBreakdownState(next)
    setPurchaseSubHeadId(null)
    setDirectExpenseSubHeadId(null)
    setTripExpenseSubHeadId(null)
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
  // Not yet approved, so not folded into costTotal/profit — Profit stays a
  // measure of realized cost only. It IS folded into Budget Utilized below,
  // since a pending claim still represents money that's committed against
  // the budget, just not booked yet.
  const pendingClaimsTotal = selected ? projectExpenseTotal(selected.id, pendingExpenses ?? []) : 0
  const vendorBillTotal = selected ? projectVendorBillTotal(selected.id, vendorBills ?? []) : 0
  // Wage cost for the days this project's crew actually worked it, per
  // resolveStaffSite (the same rule the Team Calendar shows) — a very
  // early floor date is safe since computeAccrualDays clamps to each
  // staff member's own employment window anyway.
  const salaryByWorker = selected
    ? projectWageByStaff(
        selected.id,
        todayStr(),
        staff ?? [],
        staffAttendance ?? [],
        staffAssignments ?? [],
        new Set((holidays ?? []).map((h) => h.date)),
        '2000-01-01',
        todayStr(),
      )
    : []
  const salaryTotal = salaryByWorker.reduce((s, r) => s + r.amount, 0)
  const costTotal = expenseTotal + vendorBillTotal + salaryTotal
  // GST is collected on the government's behalf, never real revenue, so
  // Invoiced/Due (and Profit, derived from Invoiced) show the ex-GST
  // figure here — same reasoning as excluding it from cost totals above.
  const invoicedRevenue = selected ? projectInvoicedRevenueExGst(selected.id, invoices ?? []) : 0
  const receivedRevenue = selected ? projectReceivedRevenue(selected.id, invoices ?? [], invoicePayments ?? []) : 0
  const balanceDue = invoicedRevenue - receivedRevenue
  const profit = invoicedRevenue - costTotal
  const budget = selected?.budget ?? null
  const utilizedTotal = costTotal + pendingClaimsTotal
  const utilizedPct = budget !== null && budget > 0 ? Math.round((utilizedTotal / budget) * 100) : null

  const projectBillRows = selected ? (vendorBills ?? []).filter((b) => b.project_id === selected.id) : []

  const purchasesBySubHead = new Map<string, number>()
  projectBillRows.forEach((b) => {
    const key = b.sub_head_id ?? 'none'
    purchasesBySubHead.set(key, (purchasesBySubHead.get(key) ?? 0) + billTotal(b))
  })

  // Trip entries are always cost_center "Trips", never "Project" — split
  // out here so a trip-linked cost doesn't get silently mixed in with
  // directly-entered Project expenses (they still both count toward the
  // Expenses total/profit above, just shown separately below).
  const projectExpenseRows = selected ? (expenses ?? []).filter((e) => e.project_id === selected.id) : []
  const directExpenseRows = projectExpenseRows.filter((e) => e.cost_center !== 'Trips')
  const tripExpenseRows = projectExpenseRows.filter((e) => e.cost_center === 'Trips')
  const directExpenseTotal = directExpenseRows.reduce((s, e) => s + Number(e.amount || 0), 0)
  const tripExpenseTotal = tripExpenseRows.reduce((s, e) => s + Number(e.amount || 0), 0)
  const tripName = (id: string | null) => (id ? trips?.find((t) => t.id === id)?.name ?? '—' : '—')

  const directExpensesBySubHead = new Map<string, number>()
  directExpenseRows.forEach((e) => {
    const key = e.sub_head_id ?? 'none'
    directExpensesBySubHead.set(key, (directExpensesBySubHead.get(key) ?? 0) + Number(e.amount || 0))
  })
  const tripExpensesBySubHead = new Map<string, number>()
  tripExpenseRows.forEach((e) => {
    const key = e.sub_head_id ?? 'none'
    tripExpensesBySubHead.set(key, (tripExpensesBySubHead.get(key) ?? 0) + Number(e.amount || 0))
  })

  // Full breakdown for the selected project — every section below is
  // life-to-date (no period filter here), regardless of which sub-head, if
  // any, happens to be expanded on screen right now.
  const exportSections: ExportSection[] = selected
    ? [
        {
          title: 'Summary',
          columns: ['Metric', 'Amount'],
          rows: [
            ['Project value', selected.value_ex_gst ?? 0],
            ['Profit', profit],
            ['Invoiced', invoicedRevenue],
            ['Due', balanceDue],
            ['Budget', budget ?? 0],
            [utilizedPct !== null ? `Utilized (${utilizedPct}%)` : 'Utilized', utilizedTotal],
            ['Purchases', vendorBillTotal],
            ['Direct Expenses', directExpenseTotal],
            ['Trip-linked Expenses', tripExpenseTotal],
            ['Salaries', salaryTotal],
            ['Pending Claims', pendingClaimsTotal],
          ],
        },
        {
          title: 'Purchases by sub-head',
          columns: ['Sub-head', 'Amount'],
          rows: Array.from(purchasesBySubHead.entries()).map(([id, amt]) => [subHeadName(id === 'none' ? null : id), amt]),
        },
        {
          title: 'Purchase transactions',
          columns: ['Date', 'Vendor', 'Sub-head', 'Description', 'Amount'],
          rows: projectBillRows
            .slice()
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((b) => [
              b.date ? fmtDate(b.date) : '—',
              vendors?.find((v) => v.id === b.vendor_id)?.name ?? '—',
              subHeadName(b.sub_head_id),
              b.description ?? '—',
              billTotal(b),
            ]),
        },
        {
          title: 'Direct expenses by sub-head',
          columns: ['Sub-head', 'Amount'],
          rows: Array.from(directExpensesBySubHead.entries()).map(([id, amt]) => [subHeadName(id === 'none' ? null : id), amt]),
        },
        {
          title: 'Direct expense transactions',
          columns: ['Date', 'Sub-head', 'Description', 'Amount'],
          rows: directExpenseRows
            .slice()
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((e) => [e.date ? fmtDate(e.date) : '—', subHeadName(e.sub_head_id), e.description ?? '—', Number(e.amount || 0)]),
        },
        {
          title: 'Trip-linked expenses by sub-head',
          columns: ['Sub-head', 'Amount'],
          rows: Array.from(tripExpensesBySubHead.entries()).map(([id, amt]) => [subHeadName(id === 'none' ? null : id), amt]),
        },
        {
          title: 'Trip-linked expense transactions',
          columns: ['Date', 'Trip', 'Sub-head', 'Description', 'Amount'],
          rows: tripExpenseRows
            .slice()
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((e) => [e.date ? fmtDate(e.date) : '—', tripName(e.trip_id), subHeadName(e.sub_head_id), e.description ?? '—', Number(e.amount || 0)]),
        },
        {
          title: 'Salaries by worker',
          columns: ['Worker', 'Amount'],
          rows: salaryByWorker.map((row) => [row.name, row.amount]),
        },
      ]
    : []

  return (
    <div>
      <ModuleHeader>Projects</ModuleHeader>

      {!projects || projects.length === 0 ? (
        <div className="empty-state">No projects yet — add one under Admin → Projects.</div>
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
              <div
                className="note"
                style={{ marginTop: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
              >
                <span>
                  {clientLabel(client)} · {selected.project_location ?? '—'} · {selected.code ?? '—'} · Started{' '}
                  {selected.start_date ? fmtDate(selected.start_date) : '—'}
                  {selected.end_date ? ` · Completed ${fmtDate(selected.end_date)}` : ''}
                </span>
                <ReportExportButtons title={selected.name} sections={exportSections} range={null} iconOnly />
              </div>

              <div className="kpi-grid-2col">
                <KpiCard label="Project value" value={selected.value_ex_gst ? fmt(selected.value_ex_gst) : '—'} />
                <KpiCard label="Profit" value={<span style={{ color: profit < 0 ? 'var(--red)' : 'var(--accent)' }}>{fmt(profit)}</span>} />
                <KpiCard label="Invoiced" value={fmt(invoicedRevenue)} />
                <KpiCard label="Due" value={fmt(balanceDue)} />
                <div className="kpi-grid-divider terracotta" />
                <KpiCard label="Budget" value={budget !== null ? fmt(budget) : '—'} />
                <KpiCard label="Utilized" value={utilizedPct !== null ? `${fmt(utilizedTotal)} (${utilizedPct}%)` : fmt(utilizedTotal)} />
                <KpiCard
                  label="Purchases"
                  value={fmt(vendorBillTotal)}
                  active={breakdown === 'purchases'}
                  onClick={() => setBreakdown(breakdown === 'purchases' ? null : 'purchases')}
                />
                <KpiCard
                  label="Direct Expenses"
                  value={fmt(directExpenseTotal)}
                  active={breakdown === 'directExpenses'}
                  onClick={() => setBreakdown(breakdown === 'directExpenses' ? null : 'directExpenses')}
                />
                <KpiCard
                  label="Trip-linked Expenses"
                  value={fmt(tripExpenseTotal)}
                  active={breakdown === 'tripExpenses'}
                  onClick={() => setBreakdown(breakdown === 'tripExpenses' ? null : 'tripExpenses')}
                />
                <KpiCard
                  label="Salaries"
                  value={fmt(salaryTotal)}
                  active={breakdown === 'salaries'}
                  onClick={() => setBreakdown(breakdown === 'salaries' ? null : 'salaries')}
                />
                <KpiCard label="Pending Claims" value={fmt(pendingClaimsTotal)} />
              </div>

              {breakdown === 'salaries' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Salaries by worker — days actually worked on this project only
                  </div>
                  {salaryByWorker.length === 0 ? (
                    <div className="note">No worked days attributed to this project yet.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {salaryByWorker.map((row) => (
                        <KpiCard key={row.staffId} label={row.name} value={fmt(row.amount)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

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

              {breakdown === 'directExpenses' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Direct expenses by sub-head
                  </div>
                  {directExpensesBySubHead.size === 0 ? (
                    <div className="note">No direct expenses recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(directExpensesBySubHead.entries()).map(([id, amt]) => (
                        <KpiCard
                          key={id}
                          label={subHeadName(id === 'none' ? null : id)}
                          value={fmt(amt)}
                          active={directExpenseSubHeadId === id}
                          onClick={() => setDirectExpenseSubHeadId(directExpenseSubHeadId === id ? null : id)}
                        />
                      ))}
                    </div>
                  )}

                  {directExpenseSubHeadId && (
                    <div style={{ marginTop: 16 }}>
                      <div className="note" style={{ marginBottom: 8 }}>
                        ▾ {subHeadName(directExpenseSubHeadId === 'none' ? null : directExpenseSubHeadId)} — transaction details
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
                            {directExpenseRows
                              .filter((e) => (e.sub_head_id ?? 'none') === directExpenseSubHeadId)
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

              {breakdown === 'tripExpenses' && (
                <div style={{ marginBottom: 18 }}>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Trip-linked expenses by sub-head — logged under Trips, shown here since they still count toward this
                    project. Edit or delete them from Trips.
                  </div>
                  {tripExpensesBySubHead.size === 0 ? (
                    <div className="note">No trip-linked expenses recorded for this project.</div>
                  ) : (
                    <div className="kpi-grid-2col">
                      {Array.from(tripExpensesBySubHead.entries()).map(([id, amt]) => (
                        <KpiCard
                          key={id}
                          label={subHeadName(id === 'none' ? null : id)}
                          value={fmt(amt)}
                          active={tripExpenseSubHeadId === id}
                          onClick={() => setTripExpenseSubHeadId(tripExpenseSubHeadId === id ? null : id)}
                        />
                      ))}
                    </div>
                  )}

                  {tripExpenseSubHeadId && (
                    <div style={{ marginTop: 16 }}>
                      <div className="note" style={{ marginBottom: 8 }}>
                        ▾ {subHeadName(tripExpenseSubHeadId === 'none' ? null : tripExpenseSubHeadId)} — transaction details
                      </div>
                      <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Trip</th>
                              <th>Description</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tripExpenseRows
                              .filter((e) => (e.sub_head_id ?? 'none') === tripExpenseSubHeadId)
                              .map((e) => (
                                <tr key={e.id}>
                                  <td>{e.date ? fmtDate(e.date) : '—'}</td>
                                  <td>{tripName(e.trip_id)}</td>
                                  <td>{e.description ?? '—'}</td>
                                  <td className="amt">{fmt(e.amount)}</td>
                                </tr>
                              ))}
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
