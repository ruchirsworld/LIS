import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { downloadImportTemplate } from '../../lib/import/template'
import { downloadExpensesImportTemplate } from '../../lib/import/expensesTemplate'
import { runImport, type ImportResultRow } from '../../lib/import/runImport'
import { runExpensesImport } from '../../lib/import/runExpensesImport'

function ImportResultsTable({ results }: { results: ImportResultRow[] }) {
  const okCount = results.filter((r) => r.status === 'ok').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
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
  )
}

/** One file-download + upload + results block, reused for each entity
 * group's own separate import file. */
function ImportFileBlock({
  label,
  onDownload,
  onImport,
  invalidateKeys,
}: {
  label: string
  onDownload: () => Promise<void>
  onImport: (file: File) => Promise<ImportResultRow[]>
  invalidateKeys: string[]
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResultRow[] | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

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
      const rows = await onImport(file)
      setResults(rows)
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
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

      {results && <ImportResultsTable results={results} />}
    </div>
  )
}

export function DataImportSection() {
  return (
    <details className="toggle-section">
      <summary>Data import</summary>

      <ImportFileBlock
        label="Expenses"
        onDownload={downloadExpensesImportTemplate}
        onImport={runExpensesImport}
        invalidateKeys={['expenses']}
      />

      <ImportFileBlock
        label="Other data (Projects, Invoices, Vendor Bills, Loans)"
        onDownload={downloadImportTemplate}
        onImport={runImport}
        invalidateKeys={['clients', 'projects', 'invoices', 'invoice_payments', 'vendor_bills', 'vendor_bill_payments', 'loans', 'loan_payments']}
      />
    </details>
  )
}
