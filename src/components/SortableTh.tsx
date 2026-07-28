import type { SortDirection } from '../lib/useSort'

export function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align,
}: {
  label: string
  sortKey: string
  activeKey: string | null
  direction: SortDirection
  onSort: (key: string) => void
  align?: 'right'
}) {
  const active = activeKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title="Click to sort"
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 10, opacity: active ? 1 : 0.3 }}>
        {active ? (direction === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}
