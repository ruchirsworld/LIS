import { Fragment, isValidElement, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../lib/auth'
import { RowMenu } from './RowMenu'
import { RecordDetails } from '../features/reports/RecordDetailModal'
import { RecordPanel } from '../features/reports/RecordPanel'

/** The one layout every list of records follows: clicking a row (or its arrow) opens the record in a compact side panel with its ID, status,
 * amount and date, all its details, and Edit / Looks right / Delete. A menu (hamburger) at the end of the row has the same actions. Edit opens
 * the record in a popup on the same page. Delete is for Admin only, so it is left out for everyone else. A row whose details are not a
 * RecordDetails keeps the older open-in-place behaviour. */
export function RecordRow({
  expanded,
  onToggle,
  colSpan,
  details,
  onEdit,
  onDelete,
  extraItems,
  className,
  title,
  children,
}: {
  expanded: boolean
  onToggle: () => void
  /** Number of columns of the table, including the arrow and the menu, so the details row spans the table. */
  colSpan: number
  /** What shows under the row when it is open. */
  details: ReactNode
  onEdit?: () => void
  /** Only Admin sees Delete. */
  onDelete?: () => void
  /** Other actions of this kind of record (for example "Record a payment"), shown above Edit. */
  extraItems?: { label: string; onClick: () => void; disabled?: boolean }[]
  className?: string
  title?: string
  /** The cells of the row, between the arrow and the menu. */
  children: ReactNode
}) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  // The details a list passes in say which record this is, so the panel can load its headline figures too.
  const panelRecord = isValidElement<{ sourceTable: string; sourceId: string }>(details) && details.type === RecordDetails ? details.props : null
  function handleRowClick(e: MouseEvent) {
    if (!panelRecord) return
    // Clicks on the row's own buttons, links and fields do their own thing.
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return
    onToggle()
  }
  const items = [
    ...(extraItems ?? []),
    ...(onEdit ? [{ label: 'Edit', onClick: onEdit }] : []),
    ...(onDelete && isAdmin ? [{ label: 'Delete', onClick: onDelete }] : []),
  ]
  return (
    <Fragment>
      <tr className={panelRecord ? [className, 'row-clickable'].filter(Boolean).join(' ') : className} title={title} onClick={handleRowClick}>
        <td style={{ width: 36 }}>
          <button type="button" className="row-expand-btn" onClick={onToggle} aria-label={expanded ? 'Hide details' : 'Show complete details'} aria-expanded={expanded}>
            {expanded && !panelRecord ? '▾' : '▸'}
          </button>
        </td>
        {children}
        <td style={{ width: 40, textAlign: 'right' }}>{items.length > 0 && <RowMenu items={items} />}</td>
      </tr>
      {expanded && panelRecord &&
        createPortal(
          // React lets a click inside a portal bubble up to the row it came from, so it is stopped here.
          <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
            <RecordPanel sourceTable={panelRecord.sourceTable} sourceId={panelRecord.sourceId} onClose={onToggle} onEdit={onEdit} onDelete={onDelete} />
          </div>,
          document.body
        )}
      {expanded && !panelRecord && (
        <tr className="pay-form-row">
          <td colSpan={colSpan}>{details}</td>
        </tr>
      )}
    </Fragment>
  )
}

/** Which rows of a list are open (showing their complete details). */
export function useOpenRows() {
  const [open, setOpen] = useState<Set<string>>(new Set())
  return {
    isOpen: (id: string) => open.has(id),
    open: (id: string) => setOpen((cur) => new Set(cur).add(id)),
    toggle: (id: string) =>
      setOpen((cur) => {
        const next = new Set(cur)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
  }
}
