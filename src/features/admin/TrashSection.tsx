import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, EmptyState, TableSkeleton } from '../../components/ui'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { TableScroll } from '../../components/TableScroll'
import { TRASH_TABLE_LABEL, useRestoreRecord, useTrash, type TrashRow } from '../../lib/queries/trash'
import { confirmAction, toast } from '../../lib/feedback'
import { getErrorMessage } from '../../lib/errors'
import { fmt, fmtDate } from '../../lib/calc/format'

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

/** The Trash: records an admin deleted. Nothing is removed for good; Restore puts a record back, with its ledger entry. */
export function TrashSection() {
  const { data, isLoading, error } = useTrash()
  const restore = useRestoreRecord()
  const [search, setSearch] = useState('')

  const rows = (data ?? []).filter((r) =>
    matchesSearch(search, [TRASH_TABLE_LABEL[r.table_name], r.display_id, r.description, r.amount, r.record_date, r.deleted_by_name, r.delete_reason])
  )

  async function handleRestore(r: TrashRow) {
    const ok = await confirmAction({
      title: 'Restore this record?',
      message: `${TRASH_TABLE_LABEL[r.table_name]} ${r.display_id ?? ''} for ${fmt(r.amount)} goes back to its list, and its entry in the books is posted again.`,
      confirmLabel: 'Restore',
    })
    if (!ok) return
    try {
      await restore.mutateAsync({ table: r.table_name, id: r.record_id })
      toast('success', `${r.display_id ?? 'Record'} restored.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not restore.'))
    }
  }

  return (
    <details className="toggle-section">
      <summary>Trash{data && data.length > 0 ? ` (${data.length})` : ''}</summary>
      <div className="note" style={{ marginTop: 0 }}>
        Deleted records wait here. Nothing is removed for good. Restore brings a record back with its entry in the books.
      </div>
      {isLoading && <TableSkeleton rows={4} columns={6} />}
      {error && <div className="note" style={{ color: 'var(--error)' }}>Could not load the Trash.</div>}
      {data && data.length === 0 && <EmptyState icon={Trash2} title="The Trash is empty">Records you delete will appear here.</EmptyState>}
      {data && data.length > 0 && (
        <>
          <div className="toolbar">
            <div className="toolbar-group toolbar-fill">
              <TableSearch value={search} onChange={setSearch} inline />
            </div>
          </div>
          <TableScroll>
            <table className="data">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="amt">Amount</th>
                  <th>Deleted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.table_name}-${r.record_id}`}>
                    <td>{TRASH_TABLE_LABEL[r.table_name]}</td>
                    <td className="mono">{r.display_id}</td>
                    <td>{fmtDate(r.record_date)}</td>
                    <td>{r.description}</td>
                    <td className="amt">{fmt(r.amount)}</td>
                    <td>
                      {r.deleted_by_name ?? '—'}, {daysAgo(r.deleted_at) === 0 ? 'today' : `${daysAgo(r.deleted_at)} days ago`}
                      {r.delete_reason ? <div className="note" style={{ margin: 0 }}>{r.delete_reason}</div> : null}
                    </td>
                    <td>
                      <Button type="button" variant="secondary" disabled={restore.isPending} onClick={() => handleRestore(r)}>
                        Restore
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </details>
  )
}
