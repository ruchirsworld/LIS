import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import type { ImportResultRow, ParsedRow } from '../../lib/import/types'

function ImportResultsTable({ results }: { results: ImportResultRow[] }) {
  const okCount = results.filter((r) => r.status === 'ok').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const warningCount = results.filter((r) => r.status === 'ok' && r.warning).length

  return (
    <>
      <div style={{ marginTop: 16, fontSize: 13 }}>
        <strong>{okCount}</strong> imported
        {warningCount > 0 && (
          <>
            {' · '}
            <strong style={{ color: 'var(--amber)' }}>{warningCount}</strong> possible duplicate(s)
          </>
        )}
        {skippedCount > 0 && (
          <>
            {' · '}
            <strong>{skippedCount}</strong> skipped
          </>
        )}
        {errorCount > 0 && (
          <>
            {' · '}
            <strong style={{ color: 'var(--red)' }}>{errorCount}</strong> failed
          </>
        )}
      </div>
      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Sheet</th>
              <th>Row</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                className={r.status === 'error' ? 'row-overdue' : undefined}
                style={r.status !== 'error' && r.warning ? { background: 'var(--amber-soft)' } : undefined}
                title={r.warning}
              >
                <td>{r.sheet}</td>
                <td>{r.row}</td>
                <td>{r.status}</td>
                <td>{r.warning ? `⚠ ${r.warning}` : r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** The review step between "file picked" and "actually written to the
 * database" — every parsed row is shown here, ready ones and errors alike,
 * so a bulk upload never silently commits something wrong. Columns are
 * whatever keys the parser's own `preview` objects happen to use, so this
 * stays generic across every entity that uses ImportFileBlock. */
function ReviewTable<T>({ rows }: { rows: ParsedRow<T>[] }) {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r.preview))))
  return (
    <div className="table-scroll" style={{ marginTop: 12 }}>
      <table className="data">
        <thead>
          <tr>
            <th>Row</th>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.row}
              className={r.status === 'error' ? 'row-overdue' : undefined}
              style={r.status !== 'error' && r.warning ? { background: 'var(--amber-soft)' } : undefined}
              title={r.warning}
            >
              <td>{r.row}</td>
              {columns.map((c) => (
                <td key={c}>{r.preview[c] ?? ''}</td>
              ))}
              <td>
                {r.status === 'ready' ? (r.warning ? `⚠ ${r.warning}` : 'Ready') : r.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One file-download + upload + review + confirm block, reused for each
 * entity group's own separate import file. Nothing is written until the
 * user has seen every parsed row and explicitly confirms — `onParse` reads
 * and validates the file only; `onCommit` is the actual insert, run only
 * over the rows that parsed cleanly. */
export function ImportFileBlock<T>({
  label,
  onDownload,
  onParse,
  onCommit,
  invalidateKeys,
}: {
  label: string
  onDownload: () => Promise<void>
  onParse: (file: File) => Promise<ParsedRow<T>[]>
  /** Only the rows that parsed cleanly (status: 'ready') — each still
   * carries its original sheet row number so results stay traceable. */
  onCommit: (rows: ParsedRow<T>[]) => Promise<ImportResultRow[]>
  invalidateKeys: string[]
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow<T>[] | null>(null)
  const [committing, setCommitting] = useState(false)
  const [results, setResults] = useState<ImportResultRow[] | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const readyRows = parsedRows?.filter((r) => r.status === 'ready') ?? []
  const errorCount = (parsedRows?.length ?? 0) - readyRows.length
  const warningCount = readyRows.filter((r) => r.warning).length

  function resetPicker() {
    setFile(null)
    setFileName(null)
    setParsedRows(null)
    setResults(null)
    setFatalError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setFileName(f?.name ?? null)
    setParsedRows(null)
    setResults(null)
    setFatalError(null)
  }

  async function handlePreview() {
    if (!file) return
    setParsing(true)
    setFatalError(null)
    try {
      const rows = await onParse(file)
      setParsedRows(rows)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm() {
    if (readyRows.length === 0) return
    setCommitting(true)
    try {
      const rowResults = await onCommit(readyRows)
      // Rows that never parsed still belong in the final tally, so nothing
      // silently vanishes between the review table and the results table.
      const skipped = (parsedRows ?? [])
        .filter((r) => r.status === 'error')
        .map((r): ImportResultRow => ({ sheet: '', row: r.row, status: 'skipped', message: r.message ?? 'Not imported' }))
      setResults([...rowResults, ...skipped])
      setParsedRows(null)
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Could not save these rows.')
    } finally {
      setCommitting(false)
      setFile(null)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="note" style={{ marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" onClick={onDownload}>
          Download sample file
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{ maxWidth: 260 }} />
        <Button type="button" onClick={handlePreview} disabled={!file || parsing}>
          {parsing ? 'Reading…' : 'Preview'}
        </Button>
        {fileName && !parsing && <span className="note" style={{ margin: 0 }}>{fileName}</span>}
      </div>

      {fatalError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: 12 }}>
          {fatalError}
        </div>
      )}

      {parsedRows && (
        <>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <strong>{readyRows.length}</strong> ready to import
            {warningCount > 0 && (
              <>
                {' · '}
                <strong style={{ color: 'var(--amber)' }}>{warningCount}</strong> possible duplicate(s)
              </>
            )}
            {errorCount > 0 && (
              <>
                {' · '}
                <strong style={{ color: 'var(--red)' }}>{errorCount}</strong> can't be imported as-is
              </>
            )}
            {' — review every row below before confirming.'}
          </div>
          <ReviewTable rows={parsedRows} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button type="button" onClick={handleConfirm} disabled={readyRows.length === 0 || committing}>
              {committing ? 'Importing…' : `Confirm import (${readyRows.length})`}
            </Button>
            <Button type="button" variant="secondary" onClick={resetPicker} disabled={committing}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {results && <ImportResultsTable results={results} />}
    </div>
  )
}
