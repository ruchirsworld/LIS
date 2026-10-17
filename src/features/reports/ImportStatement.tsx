import { useRef, useState, type ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../../components/ui'
import { fmtDate } from '../../lib/calc/format'
import { readStatementFile, toNewLines, type ReadStatement } from '../../lib/import/bankStatementFile'
import { extractLines, type ColumnMapping } from '../../lib/import/bankStatement'
import { useSaveStatementLines } from '../../lib/queries/recon'
import { useAuth } from '../../lib/auth'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'

const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'reference', label: 'Cheque or reference' },
  { key: 'withdrawal', label: 'Money out (withdrawal or debit)' },
  { key: 'deposit', label: 'Money in (deposit or credit)' },
  { key: 'amount', label: 'Single amount column' },
  { key: 'drcr', label: 'Dr/Cr column' },
  { key: 'balance', label: 'Balance' },
]

/** Load a bank statement (Excel or CSV). Its lines are saved, so the reconciliation can be carried on later without loading it again. Loading the
 * same statement twice, or one that overlaps, only adds the lines that are new. */
export function ImportStatement({ bankId, bankName }: { bankId: string; bankName: string }) {
  const { profile } = useAuth()
  const save = useSaveStatementLines(bankId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [read, setRead] = useState<ReadStatement | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lines = read && mapping ? extractLines(read.rows, read.headerRow, mapping) : []
  const headers = read ? read.rows[read.headerRow].map((c) => String(c ?? '').trim()) : []
  const first = lines.length ? lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date) : ''
  const last = lines.length ? lines.reduce((m, l) => (l.date > m ? l.date : m), lines[0].date) : ''

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const r = await readStatementFile(file)
      setRead(r)
      setMapping(r.mapping)
      setFileName(file.name)
      if (r.lines.length === 0) setError('The table was found but no transaction lines could be read. Check the columns below.')
    } catch (err) {
      setRead(null)
      setMapping(null)
      setError(getErrorMessage(err, 'Could not read that file.'))
    }
  }

  async function saveLines() {
    if (!profile || lines.length === 0) return
    try {
      const { added, skipped } = await save.mutateAsync({ lines: toNewLines(lines), fileName, userId: profile.id })
      toast('success', `${added} new line${added === 1 ? '' : 's'} saved${skipped > 0 ? `, ${skipped} already there` : ''}.`)
      setRead(null)
      setMapping(null)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the statement.'))
    }
  }

  return (
    <div className="recon-import">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(e) => void onFile(e)} aria-label="Bank statement file" hidden />
      <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
        <Upload size={16} aria-hidden="true" /> Load statement
      </Button>
      {error && (
        <div role="alert" className="note" style={{ color: 'var(--error)' }}>
          {error}
        </div>
      )}
      {read && mapping && (
        <div className="card recon-import-card">
          <div style={{ fontWeight: 600 }}>
            {fileName}: {lines.length} line{lines.length === 1 ? '' : 's'}
            {lines.length > 0 ? `, ${fmtDate(first)} to ${fmtDate(last)}` : ''}
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            Download the statement for {bankName || 'this account'} from net banking as Excel or CSV (not PDF). The lines are kept for this account, so you do not have to load them again.
          </div>
          <details style={{ margin: '8px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>Check which column is which</summary>
            <div className="form-grid" style={{ marginTop: 8 }}>
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`imp-${f.key}`}>{f.label}</label>
                  <select
                    id={`imp-${f.key}`}
                    value={mapping[f.key] === null ? '' : String(mapping[f.key])}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">(none)</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
          <div className="save-actions" style={{ justifyContent: 'flex-start' }}>
            <Button type="button" onClick={() => void saveLines()} disabled={lines.length === 0 || save.isPending}>
              {save.isPending ? 'Saving…' : `Save ${lines.length} line${lines.length === 1 ? '' : 's'}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRead(null)
                setMapping(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
