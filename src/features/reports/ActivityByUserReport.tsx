import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { TableScroll } from '../../components/TableScroll'
import { Pagination } from '../../components/Pagination'
import { Modal } from '../../components/Modal'
import { Button, CostCentreTag, EmptyState, InitialsBadge, TableSkeleton, costCentreKind } from '../../components/ui'
import { usePagination } from '../../lib/usePagination'
import { useSort } from '../../lib/useSort'
import { SortableTh } from '../../components/SortableTh'
import { fmt, fmtDate } from '../../lib/calc/format'
import { resolveEntryTarget } from '../../lib/entryTarget'
import { toast } from '../../lib/feedback'
import { useGoTo } from '../../lib/navContext'
import { useProfiles } from '../../lib/queries/admin'
import { useActivityFeed, type FeedRow } from '../../lib/queries/activityFeed'
import { useSetReviewed } from '../../lib/queries/reviews'
import { useAuth } from '../../lib/auth'
import { useUpdateExpense } from '../../lib/queries/expenses'
import { useUpdateVendorBillPayment } from '../../lib/queries/purchases'
import { getErrorMessage } from '../../lib/errors'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { ExportSection } from '../../lib/export/report'
import { ReportExportButtons } from './ReportExportButtons'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { RecordDetails, canShowRecord } from './RecordDetailModal'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { DailySummaryCard } from './DailySummaryCard'

const COLS = 11

/** The tick: has someone looked at this entry and found it right? Anyone in the back office can tick or untick. */
function CheckTick({ row }: { row: FeedRow }) {
  const set = useSetReviewed(row.source_table, row.source_id)
  const checked = !!row.checked_at
  return (
    <button
      type="button"
      className={checked ? 'check-tick checked' : 'check-tick'}
      aria-pressed={checked}
      aria-label={checked ? 'Checked. Click to remove the tick' : 'Not checked. Click to tick'}
      title={checked ? 'Checked' : 'Not checked yet'}
      disabled={set.isPending}
      onClick={async () => {
        try {
          await set.mutateAsync(!checked)
        } catch (err) {
          toast('error', getErrorMessage(err, 'Could not save the tick.'))
        }
      }}
    >
      {checked ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
    </button>
  )
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

/** Everything entered, in every module, newest first, with who entered it and on whose behalf. For one person it covers both what they
 * entered and what was entered for them. */
export function ActivityByUserReport() {
  const [range, setRange] = useState<DateRange | null>(null)
  const goTo = useGoTo()
  const { profile: me } = useAuth()
  const isAdmin = me?.role === 'admin'
  const { data: profiles } = useProfiles()
  const updateExpense = useUpdateExpense()
  const updatePayment = useUpdateVendorBillPayment()
  const [userId, setUserId] = useState('')
  const [byRecorded, setByRecorded] = useState(true)
  const [kind, setKind] = useState('')
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)
  const [search, setSearch] = useState('')
  const [changing, setChanging] = useState<FeedRow | null>(null)
  const [newOwed, setNewOwed] = useState('')
  const openRows = useOpenRows()
  const { data, isLoading, error } = useActivityFeed(userId || null, range, byRecorded)

  const nameOf = (id: string | null | undefined) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '')
  const person = profiles?.find((p) => p.id === userId)
  /** Who a reimbursable entry is to be paid back: the person named, else whoever entered an expense. */
  const owedTo = (r: FeedRow): string | null => (r.reimbursable ? r.reimburse_to ?? (r.source_table === 'expenses' ? r.entered_by : null) : null)
  const canChangeOwed = (r: FeedRow) => isAdmin && r.reimbursable && (r.source_table === 'expenses' || r.source_table === 'vendor_bill_payments')

  const rows = data ?? []
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows])
  const shown = rows.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      (!onlyUnchecked || !r.checked_at) &&
      matchesSearch(search, [r.display_id, r.description, r.kind, r.activity_date, r.recorded_at.slice(0, 10), r.amount, r.cost_center, r.project_name, r.trip_name, nameOf(r.entered_by), nameOf(r.on_behalf_of)])
  )
  // Newest entered first to begin with; the Entered on, Date and Amount headings sort the list either way.
  const { sorted, sortKey, direction, toggleSort } = useSort(
    shown,
    { entered: (r) => r.recorded_at, date: (r) => r.activity_date, amount: (r) => (r.amount === null ? null : Number(r.amount)) },
    'entered',
    'desc'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sorted ?? shown, `${search}|${kind}|${onlyUnchecked}|${userId}|${sortKey}|${direction}`)
  const uncheckedCount = rows.filter((r) => !r.checked_at).length

  async function openScreen(r: FeedRow) {
    const target = await resolveEntryTarget(r.source_table, r.source_id, r.activity_date)
    if (!target || !goTo) {
      toast('info', `I cannot open this one directly. Look for it dated ${fmtDate(r.activity_date)} in its own screen.`)
      return
    }
    goTo(target.tab, { costCenter: target.costCenter, filter: target.filter })
  }

  async function saveOwed() {
    if (!changing) return
    try {
      if (changing.source_table === 'expenses') await updateExpense.mutateAsync({ id: changing.source_id, patch: { reimburse_to: newOwed || null } })
      else await updatePayment.mutateAsync({ id: changing.source_id, patch: { paid_by: newOwed || null } })
      setChanging(null)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not change who this is reimbursed to.'))
    }
  }

  const whereText = (r: FeedRow) => [r.project_name, r.trip_name].filter(Boolean).join(' · ')

  const sections: ExportSection[] = [
    {
      title: person ? `Entries by or for ${person.name}` : 'All entries',
      columns: ['Entered on', 'Date', 'Type', 'ID', 'Details', 'Cost centre / project / trip', 'Amount', 'Entered by', 'On behalf of', 'Checked'],
      rows: shown.map((r) => [
        `${fmtDate(r.recorded_at.slice(0, 10))} ${timeOf(r.recorded_at)}`,
        fmtDate(r.activity_date),
        r.kind,
        r.display_id ?? '',
        r.description ?? '',
        [r.cost_center, whereText(r)].filter(Boolean).join(' · '),
        r.amount ?? '',
        nameOf(r.entered_by),
        nameOf(r.on_behalf_of),
        r.checked_at ? 'Yes' : 'No',
      ]),
      numericColumns: [6],
    },
  ]

  return (
    <div className="report-panel">
      <DailySummaryCard />

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle range={range} onChange={setRange} />
          <div className="field" style={{ flex: '0 1 220px', minWidth: 160 }}>
            <label>Person</label>
            <SearchableSelect
              items={profiles}
              value={userId}
              onChange={setUserId}
              getId={(p) => p.id}
              getLabel={(p) => `${p.name} (${p.role})`}
              placeholder="— Everyone —"
            />
          </div>
          <div className="field" style={{ flex: '0 1 170px' }}>
            <label htmlFor="act-kind">Module</label>
            <select id="act-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All modules</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 170px' }}>
            <label htmlFor="act-by">Dates are for</label>
            <select id="act-by" value={byRecorded ? 'recorded' : 'entry'} onChange={(e) => setByRecorded(e.target.value === 'recorded')}>
              <option value="recorded">Day it was entered</option>
              <option value="entry">Date of the entry</option>
            </select>
          </div>
          <label className="check-inline" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            <input type="checkbox" checked={onlyUnchecked} onChange={(e) => setOnlyUnchecked(e.target.checked)} />
            Unchecked only{rows.length > 0 ? ` (${uncheckedCount})` : ''}
          </label>
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Activity by user" sections={sections} range={range} iconOnly style={{ marginTop: 0 }} fileNamePrefix={`Activity_${person?.name ?? 'all'}`} />
      </div>

      {isLoading && <TableSkeleton rows={6} columns={6} />}
      {error && <div className="note" style={{ color: 'var(--error)' }}>Could not load this list. Please try again.</div>}
      {data && shown.length === 0 && <EmptyState title="Nothing to show">No entries match these filters.</EmptyState>}

      {data && shown.length > 0 && (
        <>
          <div className="note" style={{ fontWeight: 600 }}>
            {totalCount} entr{totalCount === 1 ? 'y' : 'ies'}, sorted by {sortKey === 'date' ? 'date' : sortKey === 'amount' ? 'amount' : 'when entered'} ({direction === 'desc' ? sortKey === 'amount' ? 'largest' : 'newest' : sortKey === 'amount' ? 'smallest' : 'oldest'} first).
          </div>
          <TableScroll>
            <table className="data">
              <thead>
                <tr>
                  <th title="Tick when you have checked the entry">Checked</th>
                  <th></th>
                  <SortableTh label="Entered on" sortKey="entered" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                  <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
                  <th>Module</th>
                  <th>Description</th>
                  <th>Cost centre / project / trip</th>
                  <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
                  <th>Entered by</th>
                  <th>On behalf of</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows?.map((r) => {
                  const key = `${r.source_table}-${r.source_id}`
                  const owed = owedTo(r)
                  const ccKind = costCentreKind(r.cost_center)
                  return (
                    <RecordRow
                      key={key}
                      expanded={openRows.isOpen(key)}
                      onToggle={() => openRows.toggle(key)}
                      colSpan={COLS}
                      leading={<CheckTick row={r} />}
                      details={
                        canShowRecord(r.source_table) ? (
                          <RecordDetails sourceTable={r.source_table} sourceId={r.source_id} recordedBy={nameOf(r.entered_by)} />
                        ) : (
                          <div className="note">No more details are kept for this kind of entry.</div>
                        )
                      }
                      onEdit={() => openScreen(r)}
                      extraItems={
                        canChangeOwed(r)
                          ? [
                              {
                                label: 'Change who is reimbursed',
                                onClick: () => {
                                  setChanging(r)
                                  setNewOwed(owed ?? '')
                                },
                              },
                            ]
                          : undefined
                      }
                      className={r.reimbursable ? 'row-reimb' : undefined}
                      title={r.reimbursable ? 'Recorded as reimbursement' : undefined}
                    >
                      <td className="act-entered">
                        {fmtDate(r.recorded_at.slice(0, 10))}
                        <div>{timeOf(r.recorded_at)}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.activity_date)}</td>
                      <td>
                        <span className="tag">{r.kind}</span>
                      </td>
                      <td>
                        {r.display_id && <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{r.display_id} </span>}
                        {r.description}
                        {owed && (
                          <span style={{ marginLeft: 6 }}>
                            <InitialsBadge name={nameOf(owed)} title={`To be reimbursed to ${nameOf(owed)}`} />
                          </span>
                        )}
                      </td>
                      <td>
                        {ccKind && <CostCentreTag kind={ccKind} />} {whereText(r)}
                      </td>
                      <td className="amt">{r.amount === null ? '' : fmt(r.amount)}</td>
                      <td>{nameOf(r.entered_by)}</td>
                      <td>{nameOf(r.on_behalf_of)}</td>
                    </RecordRow>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}

      {changing && (
        <Modal title="Who is this reimbursed to?" onClose={() => setChanging(null)}>
          <p style={{ marginTop: 0 }}>
            {changing.display_id} {changing.description} · {changing.amount === null ? '' : fmt(changing.amount)}
          </p>
          <div className="field">
            <label>Reimburse to</label>
            <SearchableSelect items={profiles} value={newOwed} onChange={setNewOwed} getId={(p) => p.id} getLabel={(p) => p.name} placeholder="— Whoever entered it —" />
          </div>
          <div className="save-actions">
            <Button type="button" variant="secondary" onClick={() => setChanging(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveOwed}>
              Save
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
