import { useProfiles } from '../../lib/queries/admin'
import { useCapitalTx } from '../../lib/queries/capital'
import { fmt } from '../../lib/calc/format'
import { partnerNet } from '../../lib/calc/capital'

export function CapitalSummaryTable() {
  const { data: profiles } = useProfiles()
  const { data: tx } = useCapitalTx(null)

  return (
    <details className="toggle-section">
      <summary>Net position by partner</summary>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Partner</th>
              <th style={{ textAlign: 'right' }}>Total injected</th>
              <th style={{ textAlign: 'right' }}>Total withdrawn</th>
              <th style={{ textAlign: 'right' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {(!profiles || profiles.length === 0) && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Add users in the Admin tab first
                </td>
              </tr>
            )}
            {profiles?.map((p) => {
              const { injected, withdrawn, net } = partnerNet(p.id, tx ?? [])
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="amt">{fmt(injected)}</td>
                  <td className="amt">{fmt(withdrawn)}</td>
                  <td className="amt">{fmt(net)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
