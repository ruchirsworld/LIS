import { useClients } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt } from '../../lib/calc/format'
import { netPayable, totalPaid } from '../../lib/calc/invoices'
import { clientLabel } from '../../lib/labels'

export function ClientSummaryTable() {
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
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
              <th style={{ textAlign: 'right' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {relevant.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
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

              return (
                <tr key={c.id}>
                  <td>{clientLabel(c)}</td>
                  <td className="amt">{fmt(totalInvoiced)}</td>
                  <td className="amt">{fmt(received)}</td>
                  <td className="amt">{fmt(totalInvoiced - received)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
