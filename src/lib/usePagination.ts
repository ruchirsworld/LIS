import { useState } from 'react'

export const PAGE_SIZE = 25

/** Slices a (usually already-sorted) row list into 25-row pages. Clamps
 * automatically if the row count shrinks (e.g. after a delete or a filter
 * change) so the page number is never left pointing past the end. */
export function usePagination<T>(rows: T[] | undefined) {
  const [page, setPage] = useState(1)
  const totalCount = rows?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = rows?.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  return { pageRows, page: clampedPage, setPage, totalPages, totalCount }
}
