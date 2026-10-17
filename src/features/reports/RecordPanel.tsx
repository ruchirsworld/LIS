import { useQuery } from '@tanstack/react-query'
import { SidePanel } from '../../components/SidePanel'
import { Button, StatusTag } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useReview, useSetReviewed } from '../../lib/queries/reviews'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'
import { fmt, fmtDate } from '../../lib/calc/format'
import { RecordDetails } from './RecordDetailModal'

type Row = Record<string, unknown>

/** The headline figures of a record, whatever table it comes from. */
function headline(row: Row | null | undefined): { id: string | null; amount: number | null; date: string | null } {
  if (!row) return { id: null, amount: null, date: null }
  const num = (k: string) => (typeof row[k] === 'number' ? (row[k] as number) : typeof row[k] === 'string' && row[k] !== '' && !Number.isNaN(Number(row[k])) ? Number(row[k]) : null)
  const paid = num('principal_paid') !== null || num('interest_paid') !== null ? (num('principal_paid') ?? 0) + (num('interest_paid') ?? 0) : null
  const date = ['date', 'date_taken', 'invoice_date', 'as_on'].map((k) => row[k]).find((v) => typeof v === 'string') as string | undefined
  return { id: typeof row.display_id === 'string' ? row.display_id : null, amount: num('amount') ?? num('principal') ?? paid, date: date ?? null }
}

/** A record opened from its row: a compact panel (a bottom sheet on a phone) with its ID, status, amount and date on top, every detail below,
 * and a fixed action bar. Closes with the X, Esc or a click outside, and the list stays where it was. */
export function RecordPanel({
  sourceTable,
  sourceId,
  onClose,
  onEdit,
  onDelete,
}: {
  sourceTable: string
  sourceId: string
  onClose: () => void
  onEdit?: () => void
  /** Admin only. */
  onDelete?: () => void
}) {
  const { profile } = useAuth()
  const isBackOffice = profile?.role === 'admin' || profile?.role === 'cxo'
  const isAdmin = profile?.role === 'admin'
  const { data: row } = useQuery({
    queryKey: ['record_head', sourceTable, sourceId],
    queryFn: async () => {
      const { data, error } = await supabase.from(sourceTable as 'expenses').select('*').eq('id', sourceId).maybeSingle()
      if (error) throw error
      return (data as unknown as Row | null) ?? null
    },
  })
  const review = useReview(sourceTable, sourceId, isBackOffice)
  const setReviewed = useSetReviewed(sourceTable, sourceId)
  const { id, amount, date } = headline(row)
  const reviewed = !!review.data

  async function toggleReviewed() {
    try {
      await setReviewed.mutateAsync(!reviewed)
      toast('success', reviewed ? 'Review removed.' : 'Marked as reviewed.')
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the review.'))
    }
  }

  return (
    <SidePanel
      onClose={onClose}
      title={
        <div className="record-panel-head">
          <span className="mono record-panel-id">{id ?? ''}</span>
          <span className="record-panel-amount">{amount === null ? '' : fmt(amount)}</span>
          <span className="record-panel-meta">
            {date && <span>{fmtDate(date)}</span>}
            {isBackOffice && (reviewed ? <StatusTag kind="success">Reviewed</StatusTag> : <StatusTag kind="info">Saved</StatusTag>)}
          </span>
        </div>
      }
      footer={
        <>
          {onEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose()
                onEdit()
              }}
            >
              Edit
            </Button>
          )}
          {isBackOffice && (
            <Button type="button" variant="secondary" disabled={setReviewed.isPending || review.isLoading} onClick={toggleReviewed}>
              {reviewed ? 'Undo review' : 'Looks right'}
            </Button>
          )}
          {onDelete && isAdmin && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onClose()
                onDelete()
              }}
            >
              Delete
            </Button>
          )}
        </>
      }
    >
      <RecordDetails sourceTable={sourceTable} sourceId={sourceId} />
    </SidePanel>
  )
}
