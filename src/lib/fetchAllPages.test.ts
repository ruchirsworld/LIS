import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllPages, PAGE } from './fetchAllPages'

const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i }))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('fetchAllPages', () => {
  it('returns a short list untouched, in one request', async () => {
    const f = vi.fn(async () => json(rows(0, 40)))
    vi.stubGlobal('fetch', f)
    const res = await fetchAllPages('https://x.supabase.co/rest/v1/invoices?select=*')
    expect(await res.json()).toHaveLength(40)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('keeps reading until the table runs out', async () => {
    const pages = [rows(0, PAGE), rows(PAGE, PAGE), rows(2 * PAGE, 250)]
    let n = 0
    const f = vi.fn(async () => json(pages[n++]))
    vi.stubGlobal('fetch', f)
    const res = await fetchAllPages('https://x.supabase.co/rest/v1/journal_lines?select=*')
    const body = (await res.json()) as { id: number }[]
    expect(body).toHaveLength(2 * PAGE + 250)
    expect(body[body.length - 1].id).toBe(2 * PAGE + 249)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('stops after an exactly full last page', async () => {
    const pages = [rows(0, PAGE), []]
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => json(pages[n++])))
    const res = await fetchAllPages('https://x.supabase.co/rest/v1/expenses?select=*')
    expect(await res.json()).toHaveLength(PAGE)
  })

  it('leaves writes, RPC calls, single-row reads and explicit limits alone', async () => {
    const f = vi.fn(async () => json(rows(0, PAGE)))
    vi.stubGlobal('fetch', f)
    await fetchAllPages('https://x.supabase.co/rest/v1/invoices', { method: 'POST', body: '{}' })
    await fetchAllPages('https://x.supabase.co/rest/v1/rpc/gl_balances', { method: 'POST', body: '{}' })
    await fetchAllPages('https://x.supabase.co/rest/v1/invoices?limit=5')
    await fetchAllPages('https://x.supabase.co/rest/v1/invoices?id=eq.1', { headers: { Accept: 'application/vnd.pgrst.object+json' } })
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('passes an error through instead of hiding it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'denied' }, 401)))
    const res = await fetchAllPages('https://x.supabase.co/rest/v1/invoices?select=*')
    expect(res.status).toBe(401)
  })
})
