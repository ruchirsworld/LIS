/** Extracts a human-readable message from a caught value of unknown shape.
 * `instanceof Error` alone isn't enough — Supabase/Postgrest/Storage errors
 * are usually real Error instances, but anything thrown from elsewhere
 * (a rejected native promise, a plain object, a string) can slip through
 * and previously fell back to a generic, unhelpful message. This checks
 * Error first, then duck-types for a `.message`/`.details` string, then a
 * plain string, before giving up. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    if (typeof record.message === 'string' && record.message) return record.message
    if (typeof record.details === 'string' && record.details) return record.details
  }
  if (typeof err === 'string' && err) return err
  return fallback
}
