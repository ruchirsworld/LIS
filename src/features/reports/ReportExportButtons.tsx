import { useState, type CSSProperties } from 'react'
import { exportReportPdf, exportReportExcel, type ExportSection } from '../../lib/export/report'
import { formatRangeLabel, type DateRange } from '../../lib/calc/reportPeriod'

export function ReportExportButtons({
  title,
  sections,
  range,
  style,
}: {
  title: string
  sections: ExportSection[]
  range: DateRange | null
  style?: CSSProperties
}) {
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)
  const periodLabel = formatRangeLabel(range)

  async function handlePdf() {
    setBusy('pdf')
    try {
      await exportReportPdf(title, sections, periodLabel)
    } finally {
      setBusy(null)
    }
  }

  async function handleExcel() {
    setBusy('excel')
    try {
      await exportReportExcel(title, sections, periodLabel)
    } finally {
      setBusy(null)
    }
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
