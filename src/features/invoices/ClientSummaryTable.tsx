import { useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt } from '../../lib/calc/format'
import { netPayable, totalPaid, retentionHeld, dueAmount, extraPaid } from '../../lib/calc/invoices'
import { clientLabel } from '../../lib/labels'

export function ClientSummaryTable() {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null, { sentOnly: true })
  const { data: payments } = useInvoicePayments()

  const relevant = clients?.filter((c) => invoices?.some((i) => i.client_id === c.id)) ?? []

  return (
    <details className="toggle-section">
      <summary>Consolidated by client</summary>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Client</th>
              <th style={{ textAlign: 'right' }}>Total invoiced</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Retention held</th>
              <th style={{ textAlign: 'right' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {relevant.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No invoices yet
                </td>
              </tr>
            )}
            {relevant.map((c) => {
              const invs = invoices?.filter((i) => i.client_id === c.id) ?? []
              const totalInvoiced = invs.reduce((s, i) => s + netPayable(i), 0)
              const received = invs.reduce((s, i) => {
                const invPayments = payments?.filter((p) => p.invoice_id === i.id) ?? []
                return s + totalPaid(invPayments)
              }, 0)

              const retention = invs.reduce(
                (s, i) => s + retentionHeld(i, payments?.filter((pay) => pay.invoice_id === i.id) ?? []),
                0
              )
              // Due is what is collectible now — retention held back is shown in
              // its own column, not counted here, matching the Ledger and the
              // dashboard. Overpayments on any invoice show as extra.
              const due = invs.reduce((s, i) => s + dueAmount(i, payments?.filter((pay) => pay.invoice_id === i.id) ?? []), 0)
              const extra = invs.reduce((s, i) => s + extraPaid(i, payments?.filter((pay) => pay.invoice_id === i.id) ?? []), 0)

              return (
                <tr key={c.id} className={due > 0.01 ? 'row-due' : undefined}>
                  <td>{clientLabel(c)}</td>
                  <td className="amt">{fmt(totalInvoiced)}</td>
                  <td className="amt">{fmt(received)}</td>
                  <td className={retention > 0 ? 'amt amt-retention' : 'amt'}>{retention > 0 ? fmt(retention) : '—'}</td>
                  <td className="amt">
                    {due > 0.01 ? <span className="amt-due">{fmt(due)}</span> : fmt(0)}
                    {extra > 0 && <div className="amt-extra">+{fmt(extra)} extra</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
