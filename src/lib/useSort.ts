import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'
export type SortAccessor<T> = (row: T) => string | number | null | undefined

/** Generic click-to-sort helper for record tables. Pass one accessor per
 * sortable column (keyed by whatever name you use on the `<th>`); clicking a
 * column toggles asc/desc, clicking a different column switches to it (asc). */
export function useSort<T>(
  rows: T[] | undefined,
  accessors: Record<string, SortAccessor<T>>,
  initialKey: string | null = null,
  initialDirection: SortDirection = 'desc'
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey)
  const [direction, setDirection] = useState<SortDirection>(initialDirection)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDirection('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!rows || !sortKey) return rows
    const accessor = accessors[sortKey]
    if (!accessor) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av).localeCompare(String(bv))
    })
    if (direction === 'desc') copy.reverse()
    return copy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, direction])

  return { sorted, sortKey, direction, toggleSort }
}
