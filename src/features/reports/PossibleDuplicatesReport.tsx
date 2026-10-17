import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button, EmptyState, TableSkeleton } from '../../components/ui'
import { RecordPanel } from './RecordPanel'
import { canShowRecord } from './RecordDetailModal'
import { clusterPairs, useDismissPair, usePossibleDuplicates } from '../../lib/queries/activityFeed'
import { trashRecord, type TrashTable, refreshAfterTrash } from '../../lib/queries/trash'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { confirmAction, toast } from '../../lib/feedback'
import { getErrorMessage } from '../../lib/errors'
import { useProfiles } from '../../lib/queries/admin'
import { fmt, fmtDate } from '../../lib/calc/format'

const TRASHABLE = new Set(['expenses', 'expense_reimbursements', 'capital_transactions', 'transfers', 'other_receipts', 'loans', 'loan_payments'])

/** Entries with the same amount, dates within two days of each other and a person in common (entered by, on behalf of, or to be reimbursed).
 * It only warns: each cluster can be opened, marked "not a duplicate", or have an entry deleted (to the Trash, so it can be restored). */
export function PossibleDuplicatesReport() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const qc = useQueryClient()
  const { data: profiles } = useProfiles()
  const { data, isLoading, error } = usePossibleDuplicates(null)
  const dismiss = useDismissPair()
  const [minAmount, setMinAmount] = useState('500')
  const [showDismissed, setShowDismissed] = useState(false)
  const [opened, setOpened] = useState<{ table: string; id: string } | null>(null)

  const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const min = Number(minAmount) || 0
  const pairs = (data ?? []).filter((p) => p.amount >= min)
  const live = pairs.filter((p) => !p.dismissed)
  const clusters = useMemo(() => clusterPairs(showDismissed ? pairs : live), [pairs, live, showDismissed])
  const hiddenCount = pairs.length - live.length

  async function notDuplicate(pairKeys: [string, string][]) {
    try {
      for (const [a, b] of pairKeys) await dismiss.mutateAsync({ a, b, dismiss: true })
      toast('success', 'Marked as not a duplicate.', {
        action: {
          label: 'Undo',
          onClick: () => {
            Promise.all(pairKeys.map(([a, b]) => dismiss.mutateAsync({ a, b, dismiss: false }))).catch((err) => toast('error', getErrorMessage(err, 'Could not undo.')))
          },
        },
      })
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save that.'))
    }
  }

  async function remove(table: string, id: string, label: string) {
    const ok = await confirmAction({
      title: 'Delete this entry?',
      message: `${label}. It moves to the Trash and can be restored.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await trashRecord(table as TrashTable, id, { qc })
      refreshAfterTrash(qc)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not delete.'))
    }
  }

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        These entries have the same amount, are dated within 2 days of each other and share a person (who entered it, on whose behalf, or who is to be reimbursed).
        Most are real, separate payments. Open one to check, or mark it as not a duplicate.
      </div>
      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <div className="field" style={{ maxWidth: 200 }}>
            <label htmlFor="dup-min">Ignore amounts under (₹)</label>
            <input id="dup-min" inputMode="numeric" value={minAmount} onChange={(e) => setMinAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </div>
          <label className="check-inline" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
            Show ones marked not a duplicate{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
          </label>
        </div>
      </div>

      {isLoading && <TableSkeleton rows={4} columns={5} />}
      {error && <div className="note" style={{ color: 'var(--error)' }}>Could not load this report.</div>}
      {data && clusters.length === 0 && (
        <EmptyState icon={Copy} title="No possible duplicates">Nothing matches the rule at this amount.</EmptyState>
      )}

      {clusters.map((c) => (
        <div key={c.key} className="card dup-cluster">
          <div className="dup-cluster-head">
            <strong>{fmt(c.amount)}</strong>
            <span className="note" style={{ margin: 0 }}>
              {c.entries.length} entries
            </span>
            <span style={{ flex: 1 }} />
            <Button type="button" variant="secondary" onClick={() => notDuplicate(c.pairKeys)}>
              Not a duplicate
            </Button>
          </div>
          <table className="data table-compact">
            <thead>
              <tr>
                <th>Date</th>
                <th>Module</th>
                <th>ID</th>
                <th>Details</th>
                <th>Entered by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {c.entries.map((e) => (
                <tr key={`${e.table}-${e.id}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                  <td>{e.kind}</td>
                  <td className="mono">{e.displayId}</td>
                  <td>{e.description}</td>
                  <td>{nameOf(e.enteredBy)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canShowRecord(e.table) && (
                      <Button type="button" variant="link" onClick={() => setOpened({ table: e.table, id: e.id })}>
                        Open
                      </Button>
                    )}{' '}
                    {isAdmin && TRASHABLE.has(e.table) && (
                      <Button type="button" variant="link" onClick={() => remove(e.table, e.id, `${e.kind} ${e.displayId ?? ''} of ${fmt(c.amount)} dated ${fmtDate(e.date)}`)}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {opened && <RecordPanel sourceTable={opened.table} sourceId={opened.id} onClose={() => setOpened(null)} />}
    </div>
  )
}
