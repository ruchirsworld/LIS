/** Client code is the app-wide identifier for a client, shown wherever a client name appears. */
export function clientLabel(client: { name: string; client_code?: string | null } | null | undefined): string {
  if (!client) return '—'
  return client.client_code ? `${client.client_code} — ${client.name}` : client.name
}
