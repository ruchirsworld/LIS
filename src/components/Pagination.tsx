import { Button } from './ui'

export function Pagination({
  page,
  totalPages,
  totalCount,
  onChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        padding: '10px 2px 0',
      }}
    >
      <span className="note" style={{ margin: 0 }}>
        {totalCount} entries — page {page} of {totalPages}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
