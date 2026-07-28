import { useClients, useProjects } from '../../lib/queries/masters'
import { useInvoices, useInvoicePayments } from '../../lib/queries/invoices'
import { fmt } from '../../lib/calc/format'
import { netPayable, totalPaid } from '../../lib/calc/invoices'
import { clientLabel } from '../../lib/labels'

export function ProjectSummaryTable() {
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices(null)
  const { data: payments } = useInvoicePayments()

  const relevant = projects?.filter((p) => invoices?.some((i) => i.project_id === p.id)) ?? []

  return (
    <details className="toggle-section">
      <summary>Consolidated by project</summary>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th style={{ textAlign: 'right' }}>Total invoiced</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {relevant.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No project-linked invoices yet
                </td>
              </tr>
            )}
            {relevant.map((p) => {
              const client = clients?.find((c) => c.id === p.client_id)
              const invs = invoices?.filter((i) => i.project_id === p.id) ?? []
              const totalInvoiced = invs.reduce((s, i) => s + netPayable(i), 0)
              const received = invs.reduce((s, i) => {
                const invPayments = payments?.filter((pm) => pm.invoice_id === i.id) ?? []
                return s + totalPaid(invPayments)
              }, 0)

              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{clientLabel(client)}</td>
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
