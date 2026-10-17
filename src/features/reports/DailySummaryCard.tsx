import { useMemo } from 'react'
import { KpiCard } from '../../components/ui'
import { clusterPairs, useActivityFeed, usePossibleDuplicates } from '../../lib/queries/activityFeed'
import { fmt } from '../../lib/calc/format'

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** What was entered today, at a glance: how many entries, how much, what is still unchecked, what may be a duplicate, and what lacks a receipt. */
export function DailySummaryCard() {
  const today = todayIso()
  const range = useMemo(() => ({ from: today, to: today }), [today])
  const { data: entered, isLoading } = useActivityFeed(null, range, true)
  const { data: pairs } = usePossibleDuplicates(range)

  const rows = entered ?? []
  const money = rows.filter((r) => r.direction !== null || (r.amount !== null && r.kind !== 'Opening balance'))
  const totalOut = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const totalIn = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const unchecked = rows.filter((r) => !r.checked_at).length
  const missingReceipts = rows.filter((r) => r.has_receipt === false).length
  // Clusters in which at least one entry was entered today and the pair has not been marked "not a duplicate".
  const todayKeys = new Set(rows.map((r) => `${r.source_table}:${r.source_id}`))
  const open = (pairs ?? []).filter((p) => !p.dismissed && (todayKeys.has(`${p.a_table}:${p.a_id}`) || todayKeys.has(`${p.b_table}:${p.b_id}`)))
  const duplicates = clusterPairs(open).length

  return (
    <div className="dash-grid daily-summary" aria-label="Today at a glance">
      <KpiCard label="Entries today" value={rows.length} loading={isLoading} sub={rows.length === 0 ? 'Nothing entered yet' : undefined} />
      <KpiCard
        label="Total amount"
        value={fmt(money.reduce((s, r) => s + Number(r.amount ?? 0), 0))}
        loading={isLoading}
        sub={totalOut || totalIn ? [totalOut ? `out ${fmt(totalOut)}` : '', totalIn ? `in ${fmt(totalIn)}` : ''].filter(Boolean).join(' · ') : undefined}
      />
      <KpiCard label="Unchecked" value={unchecked} loading={isLoading} tone={unchecked > 0 ? 'warn' : 'good'} sub={unchecked > 0 ? 'Not ticked yet' : 'All checked'} />
      <KpiCard label="Possible duplicates" value={duplicates} loading={isLoading} tone={duplicates > 0 ? 'warn' : 'good'} sub={duplicates > 0 ? 'See Possible duplicates' : 'None found'} />
      <KpiCard label="Missing receipts" value={missingReceipts} loading={isLoading} tone={missingReceipts > 0 ? 'warn' : 'good'} sub={missingReceipts > 0 ? 'Expenses and bills without one' : 'None missing'} />
    </div>
  )
}
