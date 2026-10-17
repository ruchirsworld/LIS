import { Fragment, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { RowMenu } from './RowMenu'

/** The one layout every list of records follows: an arrow at the start that opens the complete details of the record, and a
 * menu (hamburger) at the end with Edit and Delete. Edit opens the record in a popup on the same page. Delete is for Admin only,
 * so it is left out of the menu for everyone else. */
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
  const items = [
    ...(extraItems ?? []),
    ...(onEdit ? [{ label: 'Edit', onClick: onEdit }] : []),
    ...(onDelete && isAdmin ? [{ label: 'Delete', onClick: onDelete }] : []),
  ]
  return (
    <Fragment>
      <tr className={className} title={title}>
        <td style={{ width: 36 }}>
          <button type="button" className="row-expand-btn" onClick={onToggle} aria-label={expanded ? 'Hide details' : 'Show complete details'} aria-expanded={expanded}>
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        {children}
        <td style={{ width: 40, textAlign: 'right' }}>{items.length > 0 && <RowMenu items={items} />}</td>
      </tr>
      {expanded && (
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
