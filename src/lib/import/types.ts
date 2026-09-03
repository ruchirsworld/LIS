export interface ImportResultRow {
  sheet: string
  row: number
  status: 'ok' | 'error' | 'skipped'
  message: string
  /** Carried over from the parsed row's own `warning` so a flagged possible
   * duplicate still shows up here after commit, not just in the pre-commit
   * review step. */
  warning?: string
}

/** One parsed-but-not-yet-committed row from an uploaded sheet — the user
 * reviews these (see ImportFileBlock) before anything is actually written.
 * `preview` is a small set of human-readable fields shown in the review
 * table; `payload` is the real insert row, present only when `status` is
 * 'ready' — an 'error' row has no payload since it was never resolved. */
export interface ParsedRow<T> {
  row: number
  status: 'ready' | 'error'
  message?: string
  /** Set when this row looks like a duplicate (matches another row in the
   * same file, or an existing record already in the database) — still
   * imported normally if `status` is 'ready', just flagged for a human to
   * glance at before confirming. */
  warning?: string
  preview: Record<string, string>
  payload?: T
}
