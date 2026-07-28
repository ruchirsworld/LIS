/** Client code is the app-wide identifier for a client, shown wherever a client name appears. */
export function clientLabel(client: { name: string; client_code?: string | null } | null | undefined): string {
  if (!client) return '—'
  return client.client_code ? `${client.client_code} — ${client.name}` : client.name
}

/** Matches a CoA category name against an Expense-form toggle label (e.g.
 * "Purchase"), tolerating a pluralized category name (e.g. "Purchases") —
 * admin may have set either up before this matching existed. */
export function matchesCategoryLabel(categoryName: string, label: string): boolean {
  const n = categoryName.trim().toLowerCase()
  const l = label.trim().toLowerCase()
  return n === l || n === `${l}s`
}
