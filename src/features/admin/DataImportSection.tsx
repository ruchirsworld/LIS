import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { downloadImportTemplate } from '../../lib/import/template'
import { runImport, type ImportResultRow } from '../../lib/import/runImport'

export function DataImportSection() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResultRow[] | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  async function handleDownload() {
    await downloadImportTemplate()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setFileName(f?.name ?? null)
    setResults(null)
    setFatalError(null)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setResults(null)
    setFatalError(null)
    try {
      const rows = await runImport(file)
      setResults(rows)
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice_payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loan_payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setImporting(false)
      setFile(null)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const okCount = results?.filter((r) => r.status === 'ok').length ?? 0
  const skippedCount = results?.filter((r) => r.status === 'skipped').length ?? 0
  const errorCount = results?.filter((r) => r.status === 'error').length ?? 0

  return (
    <details className="toggle-section">
      <summary>Data import</summary>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
        <Button type="button" variant="secondary" onClick={handleDownload}>
          Download sample file
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{ maxWidth: 260 }} />
        <Button type="button" onClick={handleImport} disabled={!file || importing}>
          {importing ? 'Importing…' : 'Import'}
        </Button>
        {fileName && !importing && <span className="note" style={{ margin: 0 }}>{fileName}</span>}
      </div>

      {fatalError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: 12 }}>
          {fatalError}
        </div>
      )}

      {results && (
        <>
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <strong>{okCount}</strong> imported
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
                  <tr key={i} className={r.status === 'error' ? 'row-overdue' : undefined}>
                    <td>{r.sheet}</td>
                    <td>{r.row}</td>
                    <td>{r.status}</td>
                    <td>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  )
}
