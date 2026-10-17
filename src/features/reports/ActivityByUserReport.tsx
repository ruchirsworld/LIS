import { useMemo, useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { TableScroll } from '../../components/TableScroll'
import { Pagination } from '../../components/Pagination'
import { usePagination } from '../../lib/usePagination'
import { fmt, fmt2, fmtDate } from '../../lib/calc/format'
import { resolveEntryTarget } from '../../lib/entryTarget'
import { toast } from '../../lib/feedback'
import { useGoTo } from '../../lib/navContext'
import { useProfiles } from '../../lib/queries/admin'
import { useActivityByUser, type ActivityRow } from '../../lib/queries/reports'
import { useAuth } from '../../lib/auth'
import { useExpenses, useUpdateExpense } from '../../lib/queries/expenses'
import { useUpdateVendorBillPayment, useVendorBillPayments } from '../../lib/queries/purchases'
import { getErrorMessage } from '../../lib/errors'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { ExportSection } from '../../lib/export/report'
import { ReportExportButtons } from './ReportExportButtons'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { RecordDetailModal, RecordDetails, canShowRecord } from './RecordDetailModal'
import { RecordRow, useOpenRows } from '../../components/RecordRow'

const dateOf = (iso: string) => iso.slice(0, 10)

/** Everything one person recorded, in one list: expenses, bills, payments, receipts, transfers, loans, capital and so on. */
export function ActivityByUserReport() {
  // The dates are chosen here, from the calendar button, rather than from the page-wide period bar.
  const [range, setRange] = useState<DateRange | null>(null)
  const goTo = useGoTo()
  const { profile: me } = useAuth()
  const isAdmin = me?.role === 'admin'
  const { data: profiles } = useProfiles()
  const { data: allExpenses } = useExpenses(null)
  const { data: allPayments } = useVendorBillPayments()
  const updateExpense = useUpdateExpense()
  const updatePayment = useUpdateVendorBillPayment()
  const [userId, setUserId] = useState('')
  const [byRecorded, setByRecorded] = useState(false)
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<ActivityRow | null>(null)
  const openRows = useOpenRows()
  const { data, isLoading, error } = useActivityByUser(userId || null, range, byRecorded)

  const person = profiles?.find((p) => p.id === userId)
  const nameOf = (id: string | null | undefined) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '')

  /** Who a reimbursable entry is to be paid back to: the person the Admin named, else whoever recorded it (an expense),
   * or whoever paid out of pocket (a vendor payment). */
  function owedTo(r: ActivityRow): string | null {
    if (!r.reimbursable) return null
    if (r.source_table === 'expenses') {
      const e = allExpenses?.find((x) => x.id === r.source_id)
      return e ? e.reimburse_to ?? e.created_by : null
    }
    if (r.source_table === 'vendor_bill_payments') return allPayments?.find((x) => x.id === r.source_id)?.paid_by ?? null
    return null
  }
  const canChangeOwed = (r: ActivityRow) => isAdmin && r.reimbursable && (r.source_table === 'expenses' || r.source_table === 'vendor_bill_payments')

  async function changeOwed(r: ActivityRow, personId: string) {
    try {
      if (r.source_table === 'expenses') await updateExpense.mutateAsync({ id: r.source_id, patch: { reimburse_to: personId || null } })
      else await updatePayment.mutateAsync({ id: r.source_id, patch: { paid_by: personId || null } })
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not change who this is reimbursed to.'))
    }
  }
  const rows = data ?? []
  const shown = rows.filter(
    (r) => (!kind || r.kind === kind) && matchesSearch(search, [r.display_id, r.description, r.kind, r.activity_date, r.recorded_at.slice(0, 10), r.amount])
  )

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows])
  const summary = useMemo(() => {
    const by = new Map<string, { count: number; moneyIn: number; moneyOut: number; other: number }>()
    for (const r of rows) {
      const cur = by.get(r.kind) ?? { count: 0, moneyIn: 0, moneyOut: 0, other: 0 }
      cur.count += 1
      const amount = Number(r.amount ?? 0)
      if (r.direction === 'in') cur.moneyIn += amount
      else if (r.direction === 'out') cur.moneyOut += amount
      else cur.other += amount
      by.set(r.kind, cur)
    }
    return [...by.entries()].map(([k, v]) => ({ kind: k, ...v })).sort((a, b) => b.count - a.count)
  }, [rows])
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(shown, `${search}|${kind}`)

  /** The popup shows the record where it is; "its screen" goes to the page that holds it. */
  async function open(r: ActivityRow) {
    if (canShowRecord(r.source_table)) {
      setViewing(r)
      return
    }
    await openScreen(r)
  }

  async function openScreen(r: ActivityRow) {
    setViewing(null)
    const target = await resolveEntryTarget(r.source_table, r.source_id, r.activity_date)
    if (!target || !goTo) {
      toast('info', `I cannot open this one directly. Look for it dated ${fmtDate(r.activity_date)} in its own screen.`)
      return
    }
    goTo(target.tab, { costCenter: target.costCenter, filter: target.filter })
  }

  const amountCells = (r: ActivityRow) => {
    const amount: number | '' = r.amount === null ? '' : Number(r.amount)
    return [r.direction === 'in' ? amount : '', r.direction === 'out' ? amount : '', r.direction === null ? amount : ''] as (number | '')[]
  }

  const sections: ExportSection[] = person
    ? [
        {
          title: `What ${person.name} recorded: summary`,
          columns: ['Type', 'Entries', 'Money in', 'Money out', 'Other amounts'],
          rows: summary.map((s) => [s.kind, s.count, s.moneyIn, s.moneyOut, s.other]),
          numericColumns: [1, 2, 3, 4],
        },
        {
          title: `What ${person.name} recorded`,
          columns: ['Date', 'Recorded on', 'Type', 'ID', 'Details', 'Money in', 'Money out', 'Other amount', 'Reimburse to'],
          rows: shown.map((r) => [fmtDate(r.activity_date), fmtDate(dateOf(r.recorded_at)), r.kind, r.display_id ?? '', r.description ?? '', ...amountCells(r), r.reimbursable ? nameOf(owedTo(r)) : '']),
          numericColumns: [5, 6, 7],
        },
      ]
    : []

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Everything one person recorded, in one list. It covers entries they saved themselves: expenses, bills, payments, receipts, transfers, loans, capital, wages, imprest, trips and opening balances. An entry made on someone
        else&rsquo;s behalf is listed under the person who pressed Save. The calendar button filters by date: by the date of each entry, or by the day it was recorded if you choose that.
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '12px 0' }}>
        <div className="field" style={{ flex: '1 1 240px', minWidth: 200 }}>
          <label>Person</label>
          <SearchableSelect
            items={profiles}
            value={userId}
            onChange={(id) => {
              setUserId(id)
              setKind('')
            }}
            getId={(p) => p.id}
            getLabel={(p) => `${p.name} (${p.role})`}
            placeholder="— Choose a person —"
          />
        </div>
        <PeriodFilterToggle range={range} onChange={setRange} />
        <div className="field" style={{ flex: '0 1 190px' }}>
          <label htmlFor="act-kind">Type</label>
          <select id="act-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={kinds.length === 0}>
            <option value="">All types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '0 1 190px' }}>
          <label htmlFor="act-by">Dates are for</label>
          <select id="act-by" value={byRecorded ? 'recorded' : 'entry'} onChange={(e) => setByRecorded(e.target.value === 'recorded')}>
            <option value="entry">Date of the entry</option>
            <option value="recorded">Day it was recorded</option>
          </select>
        </div>
      </div>

      {!userId && <div className="empty-row">Choose a person to see what they recorded.</div>}
      {userId && isLoading && <div className="empty-row">Loading…</div>}
      {userId && error && <div className="note" style={{ color: 'var(--red)' }}>Could not load this list. Please try again.</div>}

      {userId && data && (
        <>
          <div className="note" style={{ fontWeight: 600 }}>
            {person?.name}: {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} in this period.
          </div>
          <ReportExportButtons title={`Activity of ${person?.name ?? ''}`} sections={sections} range={range} fileNamePrefix={`Activity_${person?.name ?? 'user'}`} />

          {summary.length > 0 && (
            <details className="toggle-section" style={{ marginBottom: 12 }}>
              <summary>Summary by type</summary>
            <TableScroll>
              <table className="data" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Entries</th>
                    <th style={{ textAlign: 'right' }}>Money in</th>
                    <th style={{ textAlign: 'right' }}>Money out</th>
                    <th style={{ textAlign: 'right' }}>Other amounts</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.kind} onClick={() => setKind(kind === s.kind ? '' : s.kind)} style={{ cursor: 'pointer', fontWeight: kind === s.kind ? 700 : undefined }} title="Click to show only this type">
                      <td>{s.kind}</td>
                      <td className="amt">{s.count}</td>
                      <td className="amt">{s.moneyIn ? fmt(s.moneyIn) : ''}</td>
                      <td className="amt">{s.moneyOut ? fmt(s.moneyOut) : ''}</td>
                      <td className="amt">{s.other ? fmt(s.other) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            </details>
          )}

          <TableSearch value={search} onChange={setSearch} />
          <TableScroll>
            <table className="data">
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Recorded on</th>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Details</th>
                  <th style={{ textAlign: 'right' }}>Money in</th>
                  <th style={{ textAlign: 'right' }}>Money out</th>
                  <th style={{ textAlign: 'right' }}>Other amount</th>
                  <th>Reimburse to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty-row">
                      Nothing recorded by {person?.name} in this period.
                    </td>
                  </tr>
                )}
                {pageRows?.map((r) => {
                  const [moneyIn, moneyOut, other] = amountCells(r)
                  return (
                    <RecordRow
                      key={`${r.source_table}-${r.source_id}`}
                      expanded={openRows.isOpen(`${r.source_table}-${r.source_id}`)}
                      onToggle={() => openRows.toggle(`${r.source_table}-${r.source_id}`)}
                      colSpan={11}
                      details={
                        canShowRecord(r.source_table) ? (
                          <RecordDetails sourceTable={r.source_table} sourceId={r.source_id} recordedBy={person?.name} />
                        ) : (
                          <div className="note">No more details are kept for this kind of entry.</div>
                        )
                      }
                      // Changing an entry is done on its own screen; the popup and the arrow are for checking it.
                      extraItems={[
                        ...(canShowRecord(r.source_table) ? [{ label: 'View in a popup', onClick: () => void open(r) }] : []),
                        { label: 'Open its screen', onClick: () => void openScreen(r) },
                      ]}
                      className={r.reimbursable ? 'row-reimb' : undefined}
                      title={r.reimbursable ? 'Recorded as reimbursement' : undefined}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.activity_date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(dateOf(r.recorded_at))}</td>
                      <td>
                        {r.kind}
                        {r.reimbursable && (
                          <div className="retention-note" style={{ fontWeight: 600 }}>
                            Reimbursement
                          </div>
                        )}
                      </td>
                      <td>{r.display_id ?? '—'}</td>
                      <td>{r.description || '—'}</td>
                      <td className="amt">{moneyIn === '' ? '' : fmt2(Number(moneyIn))}</td>
                      <td className="amt">{moneyOut === '' ? '' : fmt2(Number(moneyOut))}</td>
                      <td className="amt">{other === '' ? '' : fmt2(Number(other))}</td>
                      <td>
                        {r.reimbursable &&
                          (canChangeOwed(r) ? (
                            <select
                              aria-label="Reimburse to"
                              value={owedTo(r) ?? ''}
                              onChange={(e) => void changeOwed(r, e.target.value)}
                              disabled={updateExpense.isPending || updatePayment.isPending}
                              style={{ maxWidth: 150 }}
                            >
                              <option value="">— Not set —</option>
                              {(profiles ?? []).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            nameOf(owedTo(r)) || '—'
                          ))}
                      </td>
                    </RecordRow>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}

      {viewing && (
        <RecordDetailModal
          title={`${viewing.kind}${viewing.display_id ? ` ${viewing.display_id}` : ''}`}
          sourceTable={viewing.source_table}
          sourceId={viewing.source_id}
          recordedBy={person?.name}
          onClose={() => setViewing(null)}
          onOpenScreen={() => void openScreen(viewing)}
        />
      )}
    </div>
  )
}
