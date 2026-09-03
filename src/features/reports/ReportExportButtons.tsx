import { useState, type CSSProperties } from 'react'
import { exportReportPdf, exportReportExcel, type ExportSection } from '../../lib/export/report'
import { formatRangeLabel, type DateRange } from '../../lib/calc/reportPeriod'

// Color-coded file badges (red = PDF, green = Excel) rather than currentColor
// outlines — recognizable at a glance the way a real attachment icon is,
// without relying on hover state to read as "this one's the PDF button".
function PdfIcon() {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20">
      <rect width="30" height="20" rx="4" fill="var(--red)" />
      <text x="15" y="14" textAnchor="middle" fontSize="10" fontFamily="inherit" fontWeight="700" fill="#fff">
        PDF
      </text>
    </svg>
  )
}

function ExcelIcon() {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20">
      <rect width="30" height="20" rx="4" fill="var(--green)" />
      <text x="15" y="14" textAnchor="middle" fontSize="10" fontFamily="inherit" fontWeight="700" fill="#fff">
        XLS
      </text>
    </svg>
  )
}

export function ReportExportButtons({
  title,
  sections,
  range,
  style,
  iconOnly,
  headerNote,
  fileNamePrefix,
}: {
  title: string
  sections: ExportSection[]
  range: DateRange | null
  style?: CSSProperties
  /** Compact icon-only buttons instead of "Download PDF" / "Download Excel"
   * text — for tight toolbars like the Expense records header. */
  iconOnly?: boolean
  /** One extra identifying line about who/what this report is about — e.g.
   * a client's GST no. on their ledger — printed under the title, above the
   * period, in both the PDF header and the Excel sheet's header rows. */
  headerNote?: string
  /** Overrides what the downloaded filename is built from — e.g. a client's
   * code ("RKC_Ledger") instead of their full name, which is what the
   * in-document title shows. Falls back to `title` when omitted. */
  fileNamePrefix?: string
}) {
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)
  const periodLabel = formatRangeLabel(range)

  async function handlePdf() {
    setBusy('pdf')
    try {
      await exportReportPdf(title, sections, periodLabel, headerNote, fileNamePrefix)
    } finally {
      setBusy(null)
    }
  }

  async function handleExcel() {
    setBusy('excel')
    try {
      await exportReportExcel(title, sections, periodLabel, headerNote, fileNamePrefix)
    } finally {
      setBusy(null)
    }
  }

  if (iconOnly) {
    return (
      <div style={{ display: 'flex', gap: 4, ...style }}>
        <button type="button" className="icon-btn" onClick={handlePdf} disabled={busy !== null} title="Download PDF" aria-label="Download PDF">
          <PdfIcon />
        </button>
        <button type="button" className="icon-btn" onClick={handleExcel} disabled={busy !== null} title="Download Excel" aria-label="Download Excel">
          <ExcelIcon />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, ...style }}>
      <button type="button" className="pay-btn" onClick={handlePdf} disabled={busy !== null}>
        {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
      </button>
      <button type="button" className="pay-btn" onClick={handleExcel} disabled={busy !== null}>
        {busy === 'excel' ? 'Preparing…' : 'Download Excel'}
      </button>
    </div>
  )
}
