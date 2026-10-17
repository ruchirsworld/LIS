import { Fragment, useState } from 'react'
import { useAuditLog, type AuditLogRow } from '../../lib/queries/audit'
import { useProfiles } from '../../lib/queries/admin'
import { fmtDate } from '../../lib/calc/format'
import { TableSearch, matchesSearch } from '../../components/TableSearch'

const TABLE_LABELS: Record<string, string> = {
  expenses: 'Expense',
  expense_reimbursements: 'Expense reimbursement',
  vendor_bills: 'Vendor bill',
  vendor_bill_payments: 'Vendor bill payment',
  invoices: 'Invoice',
  invoice_payments: 'Invoice payment',
  loans: 'Loan',
  loan_payments: 'Loan payment',
  capital_transactions: 'Capital transaction',
  transfers: 'Transfer',
  wage_accruals: 'Wage accrual',
  wage_payments: 'Wage payment',
  staff_imprest_transactions: 'Site imprest',
  staff_salary_advances: 'Salary advance',
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

/** Field-level diff between the row before and after — only the columns
 * that actually changed, since most edits touch one or two fields. */
function changedFields(row: AuditLogRow): { field: string; from: unknown; to: unknown }[] {
  if (row.operation === 'DELETE' || !row.old_data || !row.new_data) return []
  const keys = new Set([...Object.keys(row.old_data), ...Object.keys(row.new_data)])
  const diffs: { field: string; from: unknown; to: unknown }[] = []
  for (const key of keys) {
    if (['created_at', 'updated_at'].includes(key)) continue
    const a = row.old_data[key]
    const b = row.new_data[key]
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ field: key, from: a, to: b })
  }
  return diffs
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

export function AuditLogReport() {
  const { data: log } = useAuditLog()
  const { data: profiles } = useProfiles()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tableFilter, setTableFilter] = useState('')
  const [search, setSearch] = useState('')

  const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  // The search looks at who and when, and at everything the record held before and after the change (ID, description, amount, names).
  const rows = (log ?? []).filter(
    (r) =>
      (!tableFilter || r.table_name === tableFilter) &&
      matchesSearch(search, [TABLE_LABELS[r.table_name] ?? r.table_name, r.operation, nameOf(r.changed_by), r.changed_at, ...Object.values(r.old_data ?? {}), ...Object.values(r.new_data ?? {})])
  )

  return (
    <div className="report-panel">
      <div className="note" style={{ marginBottom: 12 }}>
        Every recorded edit and delete across the tables that matter — who changed what, and what it looked like before.
        Showing the most recent 500.
      </div>
      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <div className="field" style={{ maxWidth: 260 }}>
            <label>Table</label>
            <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
              <option value="">— All tables —</option>
              {Object.entries(TABLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <TableSearch value={search} onChange={setSearch} inline placeholder="Search by who, ID, description, amount or date…" />
        </div>
      </div>
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Table</th>
              <th>Action</th>
              <th>Changed by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No changes recorded yet
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const diffs = changedFields(r)
              const isExpanded = expandedId === r.id
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      {fmtDate(r.changed_at.slice(0, 10))} {timeOf(r.changed_at)}
                    </td>
                    <td>{TABLE_LABELS[r.table_name] ?? r.table_name}</td>
                    <td>
                      <span className={r.operation === 'DELETE' ? 'badge overdue' : 'badge sent'}>{r.operation}</span>
                    </td>
                    <td>{nameOf(r.changed_by)}</td>
                    <td>
                      <button type="button" className="pay-btn" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                        {isExpanded ? 'Hide' : r.operation === 'DELETE' ? 'View' : `${diffs.length} field${diffs.length === 1 ? '' : 's'}`}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="pay-form-row">
                      <td colSpan={5}>
                        {r.operation === 'DELETE' ? (
                          <div className="note">
                            Deleted record: {r.old_data ? JSON.stringify(r.old_data) : '—'}
                          </div>
                        ) : diffs.length === 0 ? (
                          <div className="empty-state">No field-level changes detected.</div>
                        ) : (
                          <table className="data" style={{ marginTop: 0 }}>
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Before</th>
                                <th>After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diffs.map((d) => (
                                <tr key={d.field}>
                                  <td>{d.field}</td>
                                  <td>{displayValue(d.from)}</td>
                                  <td>{displayValue(d.to)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
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
  )
}
