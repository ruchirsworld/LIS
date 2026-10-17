import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
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
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { ExportSection } from '../../lib/export/report'
import { ReportExportButtons } from './ReportExportButtons'

const dateOf = (iso: string) => iso.slice(0, 10)

/** Everything one person recorded, in one list: expenses, bills, payments, receipts, transfers, loans, capital and so on. */
export function ActivityByUserReport({ range }: { range: DateRange | null }) {
  const goTo = useGoTo()
  const { data: profiles } = useProfiles()
  const [userId, setUserId] = useState('')
  const [byRecorded, setByRecorded] = useState(false)
  const [kind, setKind] = useState('')
  const { data, isLoading, error } = useActivityByUser(userId || null, range, byRecorded)

  const person = profiles?.find((p) => p.id === userId)
  const rows = data ?? []
  const shown = kind ? rows.filter((r) => r.kind === kind) : rows

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
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(shown)

  async function open(r: ActivityRow) {
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
          columns: ['Date', 'Recorded on', 'Type', 'ID', 'Details', 'Money in', 'Money out', 'Other amount', 'Status'],
          rows: shown.map((r) => [fmtDate(r.activity_date), fmtDate(dateOf(r.recorded_at)), r.kind, r.display_id ?? '', r.description ?? '', ...amountCells(r), r.status ?? '']),
          numericColumns: [5, 6, 7],
        },
      ]
    : []

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        Everything one person recorded, in one list. It covers entries they saved themselves: expenses, bills, payments, receipts, transfers, loans, capital, wages, imprest, trips and opening balances. An entry made on someone
        else&rsquo;s behalf is listed under the person who pressed Save. The dates above filter by the date of each entry, or by the day it was recorded if you choose that below.
      </div>

      <div className="form-grid" style={{ margin: '12px 0' }}>
        <div className="field">
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
        <div className="field">
          <label htmlFor="act-by">Dates above apply to</label>
          <select id="act-by" value={byRecorded ? 'recorded' : 'entry'} onChange={(e) => setByRecorded(e.target.value === 'recorded')}>
            <option value="entry">The date of each entry</option>
            <option value="recorded">The day it was recorded</option>
          </select>
        </div>
        <div className="field">
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
          )}

          <TableScroll>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Recorded on</th>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Details</th>
                  <th style={{ textAlign: 'right' }}>Money in</th>
                  <th style={{ textAlign: 'right' }}>Money out</th>
                  <th style={{ textAlign: 'right' }}>Other amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-row">
                      Nothing recorded by {person?.name} in this period.
                    </td>
                  </tr>
                )}
                {pageRows?.map((r) => {
                  const [moneyIn, moneyOut, other] = amountCells(r)
                  return (
                    <tr key={`${r.source_table}-${r.source_id}`} className={r.reimbursable ? 'row-reimb' : undefined} title={r.reimbursable ? 'Recorded as reimbursement' : undefined}>
                      <td>{fmtDate(r.activity_date)}</td>
                      <td>{fmtDate(dateOf(r.recorded_at))}</td>
                      <td>{r.kind}</td>
                      <td>{r.display_id ?? '—'}</td>
                      <td>{r.description || '—'}</td>
                      <td className="amt">{moneyIn === '' ? '' : fmt2(Number(moneyIn))}</td>
                      <td className="amt">{moneyOut === '' ? '' : fmt2(Number(moneyOut))}</td>
                      <td className="amt">{other === '' ? '' : fmt2(Number(other))}</td>
                      <td>{r.status ?? ''}</td>
                      <td>
                        <Button type="button" variant="secondary" onClick={() => void open(r)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </div>
  )
}
