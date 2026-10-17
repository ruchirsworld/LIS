export interface DuplicatePair {
  a_table: string
  a_id: string
  a_display_id: string | null
  a_kind: string
  a_date: string
  a_recorded_at: string
  a_description: string | null
  a_entered_by: string | null
  b_table: string
  b_id: string
  b_display_id: string | null
  b_kind: string
  b_date: string
  b_recorded_at: string
  b_description: string | null
  b_entered_by: string | null
  amount: number
  dismissed: boolean
}

/** Groups pairs into clusters: entries linked directly or through others. */
export function clusterPairs(pairs: DuplicatePair[]): { key: string; entries: { table: string; id: string; displayId: string | null; kind: string; date: string; recordedAt: string; description: string | null; enteredBy: string | null }[]; amount: number; pairKeys: [string, string][] }[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  const info = new Map<string, { table: string; id: string; displayId: string | null; kind: string; date: string; recordedAt: string; description: string | null; enteredBy: string | null }>()
  for (const p of pairs) {
    const ka = `${p.a_table}:${p.a_id}`
    const kb = `${p.b_table}:${p.b_id}`
    info.set(ka, { table: p.a_table, id: p.a_id, displayId: p.a_display_id, kind: p.a_kind, date: p.a_date, recordedAt: p.a_recorded_at, description: p.a_description, enteredBy: p.a_entered_by })
    info.set(kb, { table: p.b_table, id: p.b_id, displayId: p.b_display_id, kind: p.b_kind, date: p.b_date, recordedAt: p.b_recorded_at, description: p.b_description, enteredBy: p.b_entered_by })
    parent.set(find(ka), find(kb))
  }
  const groups = new Map<string, { keys: Set<string>; amount: number; pairKeys: [string, string][] }>()
  for (const p of pairs) {
    const ka = `${p.a_table}:${p.a_id}`
    const kb = `${p.b_table}:${p.b_id}`
    const root = find(ka)
    const g = groups.get(root) ?? { keys: new Set<string>(), amount: p.amount, pairKeys: [] }
    g.keys.add(ka)
    g.keys.add(kb)
    g.pairKeys.push([ka, kb])
    groups.set(root, g)
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      amount: g.amount,
      pairKeys: g.pairKeys,
      entries: [...g.keys].map((k) => info.get(k)!).sort((x, y) => y.date.localeCompare(x.date) || y.recordedAt.localeCompare(x.recordedAt)),
    }))
    .sort((a, b) => b.amount - a.amount)
}
