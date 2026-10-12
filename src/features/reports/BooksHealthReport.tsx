import { Button } from '../../components/ui'
import { useBooksHealth } from '../../lib/queries/books'
import { fmt2 } from '../../lib/calc/format'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 }
const SEVERITY_LABEL: Record<string, string> = { error: 'Fix', warning: 'Review', info: 'Note' }

/** Everything in the books that needs a look, straight from the ledger: entries
 * that don't balance, invoices that disagree with their posting, a negative
 * cash balance, duplicate invoice numbers, missing GST details, and the
 * reconciliations to do against returns and Form 26AS. A "Fix" item means the
 * books are wrong; "Review" means something is probably wrong or incomplete;
 * "Note" is for information. Not scoped to the period filter. */
export function BooksHealthReport() {
  const { data: checks, isLoading, refetch, isFetching } = useBooksHealth()

  const sorted = [...(checks ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.check_code.localeCompare(b.check_code)
  )
  const count = (sev: string) => sorted.filter((c) => c.severity === sev).length

  const sections: ExportSection[] = [
    {
      title: 'Books health check',
      columns: ['Status', 'Check', 'Detail', 'Amount'],
      rows: sorted.map((c) => [SEVERITY_LABEL[c.severity] ?? c.severity, c.title, c.detail, c.amount == null ? '' : Number(c.amount)]),
      numericColumns: [3],
      decimals: 2,
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        A live audit of the ledger — not scoped to the period filter. <strong>Fix</strong> means the books are wrong, <strong>Review</strong> means
        something is probably wrong or incomplete, <strong>Note</strong> is for information.
      </div>

      <div className="dash-grid" style={{ marginTop: 12 }}>
        <div className={`dash-card ${count('error') ? 'dash-card-danger' : 'dash-card-good'}`}>
          <div className="dash-label">To fix</div>
          <div className="dash-value">{count('error')}</div>
        </div>
        <div className={`dash-card ${count('warning') ? 'dash-card-warn' : 'dash-card-good'}`}>
          <div className="dash-label">To review</div>
          <div className="dash-value">{count('warning')}</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">Notes</div>
          <div className="dash-value">{count('info')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <ReportExportButtons title="Books health check" sections={sections} range={null} style={{ marginTop: 0 }} />
        <Button type="button" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Checking…' : 'Run the check again'}
        </Button>
      </div>

      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Status</th>
              <th>Check</th>
              <th>Detail</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Checking the books…
                </td>
              </tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Nothing to report — the books are in order.
                </td>
              </tr>
            )}
            {sorted.map((c, i) => (
              <tr key={`${c.check_code}-${i}`}>
                <td>
                  <span className={`badge ${c.severity === 'error' ? 'overdue' : c.severity === 'warning' ? 'sent' : 'draft'}`}>
                    {SEVERITY_LABEL[c.severity] ?? c.severity}
                  </span>
                </td>
                <td>{c.title}</td>
                <td>{c.detail}</td>
                <td className="amt">{c.amount == null ? '—' : fmt2(Number(c.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
