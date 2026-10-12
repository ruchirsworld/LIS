// The REST API returns at most 1,000 rows per request and says nothing when it
// cuts a result short, so a report or ledger would quietly lose its tail. This
// wraps fetch: any plain list read (GET, array result, no explicit range or
// limit) keeps asking for the next 1,000 rows until the table runs out.
export const PAGE = 1000

function withRange(headers: Headers, from: number): Headers {
  const next = new Headers(headers)
  next.set('Range-Unit', 'items')
  next.set('Range', `${from}-${from + PAGE - 1}`)
  return next
}

export async function fetchAllPages(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = new URL(input instanceof Request ? input.url : input.toString())
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const isListRead =
    method === 'GET' &&
    url.pathname.startsWith('/rest/v1/') &&
    !url.pathname.startsWith('/rest/v1/rpc/') &&
    !url.searchParams.has('limit') &&
    !url.searchParams.has('offset') &&
    !headers.has('Range') &&
    !(headers.get('Accept') ?? '').includes('vnd.pgrst.object')
  if (!isListRead) return fetch(input, init)

  const first = await fetch(input, { ...init, headers: withRange(headers, 0) })
  if (!first.ok || first.status === 204) return first
  const firstRows: unknown = await first.clone().json().catch(() => null)
  if (!Array.isArray(firstRows) || firstRows.length < PAGE) return first

  const rows: unknown[] = [...firstRows]
  for (let from = PAGE; ; from += PAGE) {
    const next = await fetch(input, { ...init, headers: withRange(headers, from) })
    if (!next.ok) return next
    const part: unknown = await next.json()
    if (!Array.isArray(part)) break
    rows.push(...part)
    if (part.length < PAGE) break
  }
  const out = new Headers(first.headers)
  out.delete('content-length')
  out.delete('content-range')
  return new Response(JSON.stringify(rows), { status: 200, statusText: first.statusText, headers: out })
}

