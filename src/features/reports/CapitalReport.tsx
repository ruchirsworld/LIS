import { usePartners } from '../../lib/queries/masters'
import { useCapitalTx } from '../../lib/queries/capital'
import { partnerNet } from '../../lib/calc/capital'
import { inRange } from '../../lib/calc/period'
import { fmt } from '../../lib/calc/format'
import type { DateRange } from '../../lib/calc/reportPeriod'
import { ReportExportButtons } from './ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'

export function CapitalReport({ range }: { range: DateRange | null }) {
  const { data: partners } = usePartners()
  const { data: tx } = useCapitalTx(null)

  const from = range?.from ?? null
  const to = range?.to ?? null
  const periodTx = (tx ?? []).filter((t) => inRange(t.date, from, to))

  const rows = (partners ?? []).map((p) => {
    const period = partnerNet(p.id, periodTx)
    const toDate = partnerNet(p.id, tx ?? [])
    return { id: p.id, name: p.name, injected: period.injected, withdrawn: period.withdrawn, net: toDate.net }
  })

  const sections: ExportSection[] = [
    {
      title: 'Capital report',
      columns: ['Partner', 'Injected (period)', 'Withdrawn (period)', 'Net position (to date)'],
      rows: rows.map((r) => [r.name, r.injected, r.withdrawn, r.net]),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Capital report</summary>
      <ReportExportButtons title="Capital report" sections={sections} range={range} />
      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Partner</th>
              <th style={{ textAlign: 'right' }}>Injected (period)</th>
              <th style={{ textAlign: 'right' }}>Withdrawn (period)</th>
              <th style={{ textAlign: 'right' }}>Net position (to date)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No partners yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="amt">{fmt(r.injected)}</td>
                <td className="amt">{fmt(r.withdrawn)}</td>
                <td className="amt">{fmt(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
