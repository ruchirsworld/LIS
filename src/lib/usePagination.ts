import { useEffect, useState } from 'react'

export const PAGE_SIZE = 25

/** Slices a (usually already-sorted) row list into 25-row pages. Clamps
 * automatically if the row count shrinks (e.g. after a delete or a filter
 * change) so the page number is never left pointing past the end. When
 * `resetKey` changes (for example the text typed in a search box) it goes back
 * to the first page. */
export function usePagination<T>(rows: T[] | undefined, resetKey?: string) {
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [resetKey])
  const totalCount = rows?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = rows?.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  return { pageRows, page: clampedPage, setPage, totalPages, totalCount }
}
