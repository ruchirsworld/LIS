import { Fragment, useMemo, useState } from 'react'
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

  // Grouped the same way as the Admin and Project expense records: a month heading, then the dates inside it. Each date group is
  // blue or green in turn and its rows alternate light and a little deeper.
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const flip = (set: Set<string>, key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }
  const rowKeyOf = (r: ActivityRow) => `${r.source_table}-${r.source_id}`
  const segmentOfDate = new Map<string, 0 | 1>()
  const rowShade = new Map<string, 0 | 1>()
  {
    let segment = -1
    let previousDate = ''
    let alternate = 0
    for (const r of pageRows ?? []) {
      if (r.activity_date !== previousDate) {
        segment += 1
        alternate = 0
        previousDate = r.activity_date
        segmentOfDate.set(r.activity_date, (segment % 2) as 0 | 1)
      }
      if (collapsedDates.has(r.activity_date) || collapsedMonths.has(r.activity_date.slice(0, 7))) continue
      rowShade.set(rowKeyOf(r), (alternate % 2) as 0 | 1)
      alternate += 1
    }
  }
  // A month or a day covers every entry of it, not only the ones on this page.
  const totalsOf = (match: (r: ActivityRow) => boolean) => {
    const list = shown.filter(match)
    const sum = (direction: string) => list.filter((r) => r.direction === direction).reduce((s, r) => s + Number(r.amount ?? 0), 0)
    return { count: list.length, moneyIn: sum('in'), moneyOut: sum('out') }
  }
  const totalsText = (t: { count: number; moneyIn: number; moneyOut: number }) =>
    [`${t.count} entr${t.count === 1 ? 'y' : 'ies'}`, t.moneyIn ? `in ${fmt(t.moneyIn)}` : '', t.moneyOut ? `out ${fmt(t.moneyOut)}` : ''].filter(Boolean).join(' · ')

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
                {pageRows?.map((r, idx) => {
                  const [moneyIn, moneyOut, other] = amountCells(r)
                  const month = r.activity_date.slice(0, 7)
                  const isNewMonth = idx === 0 || pageRows[idx - 1].activity_date.slice(0, 7) !== month
                  const monthFolded = collapsedMonths.has(month)
                  const isNewDate = idx === 0 || pageRows[idx - 1].activity_date !== r.activity_date
                  const dateFolded = collapsedDates.has(r.activity_date)
                  const segment = segmentOfDate.get(r.activity_date) ?? 0
                  const shade = rowShade.get(rowKeyOf(r)) ?? 0
                  return (
                    <Fragment key={rowKeyOf(r)}>
                    {isNewMonth && (
                      <tr className="expense-month-group-row" onClick={() => setCollapsedMonths((cur) => flip(cur, month))} style={{ cursor: 'pointer' }}>
                        <td colSpan={11}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                            <span>
                              <span style={{ display: 'inline-block', width: 16, fontSize: 12, opacity: 0.6 }}>{monthFolded ? '▸' : '▾'}</span>
                              {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{totalsText(totalsOf((x) => x.activity_date.slice(0, 7) === month))}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isNewDate && !monthFolded && (
                      <tr className={`expense-date-group-row grp-head-${segment}`} onClick={() => setCollapsedDates((cur) => flip(cur, r.activity_date))} style={{ cursor: 'pointer' }}>
                        <td colSpan={11} style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 14, fontSize: 11, opacity: 0.6 }}>{dateFolded ? '▸' : '▾'}</span>
                          {fmtDate(r.activity_date)} — {totalsText(totalsOf((x) => x.activity_date === r.activity_date))}
                        </td>
                      </tr>
                    )}
                    {!monthFolded && !dateFolded && (
                    <RecordRow
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
                      className={`grp-row grp-seg-${segment} grp-alt-${shade}${r.reimbursable ? ' row-reimb' : ''}`}
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
                    )}
                    </Fragment>
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
