import { KpiCard } from '../../components/ui'
import { useReportSummary } from '../../lib/queries/reports'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function GstSummaryReport({ range }: { range: DateRange | null }) {
  const { data } = useReportSummary(range)
  const netGst = (data?.output_gst ?? 0) - (data?.input_gst ?? 0)

  const metrics: [string, number][] = [
    ['Output GST (on invoices)', data?.output_gst ?? 0],
    ['Input GST (on vendor bills)', data?.input_gst ?? 0],
    ['Net GST payable', netGst],
    ['TDS deducted (by clients)', data?.tds_deducted ?? 0],
  ]

  const sections: ExportSection[] = [
    { title: 'GST summary', columns: ['Metric', 'Amount'], rows: metrics.map(([m, v]) => [m, v]) },
  ]

  return (
    <details className="toggle-section" open>
      <summary>GST summary</summary>
      <ReportExportButtons title="GST summary" sections={sections} range={range} />
      <div className="dash-grid" style={{ marginTop: 16 }}>
        {metrics.map(([label, value]) => (
          <KpiCard key={label} label={label} value={fmt(value)} />
        ))}
      </div>
    </details>
  )
}
