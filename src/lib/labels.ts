/** Short, on-screen client identifier — just the client code, falling back
 * to the full name only when no code is on file. Used everywhere in the
 * app's own UI (pickers, table cells). Downloaded reports show the full
 * name instead — see clientFullName(). */
export function clientLabel(client: { name: string; client_code?: string | null } | null | undefined): string {
  if (!client) return '—'
  return client.client_code || client.name
}

/** Full client name, with no code — used wherever a client is identified
 * in a downloaded PDF/Excel report, as opposed to the app's own on-screen
 * UI (which shows just the code via clientLabel()). */
export function clientFullName(client: { name: string } | null | undefined): string {
  return client?.name ?? '—'
}

/** "GST: <number>" for a client, or null when none is on file — so callers
 * can skip the line entirely rather than printing an empty one. */
export function clientGstLine(client: { gst?: string | null } | null | undefined): string | null {
  return client?.gst ? `GST: ${client.gst}` : null
}
