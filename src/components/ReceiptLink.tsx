import { useState } from 'react'
import { getReceiptUrl } from '../lib/storage'

/** Bucket is private, so the signed URL is fetched on demand rather than eagerly for every row. */
export function ReceiptLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const url = await getReceiptUrl(path)
    setLoading(false)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <button type="button" className="btn link" onClick={open} disabled={loading}>
      {loading ? '…' : '📎 view'}
    </button>
  )
}
