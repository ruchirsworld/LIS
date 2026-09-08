import { Fragment, useState } from 'react'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RowMenu } from '../../components/RowMenu'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useInvoices, useInvoicePayments, useDeleteInvoicePayment } from '../../lib/queries/invoices'
import { useClients } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import { EditInvoicePaymentFields } from './InvoicePaymentForm'
import type { Database } from '../../types/database'

type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']

const COL_SPAN = 8

/** Every invoice payment (receipt) across every client/invoice, in one
 * place — InvoiceTable above only ever shows a given invoice's own
 * payments once you expand that row, so this is the only place to browse
 * or search receipts across the whole book. */
export function InvoicePaymentRecordsTable() {
  const { data: payments, isLoading } = useInvoicePayments()
  const { data: invoices } = useInvoices(null)
  const { data: clients } = useClients()
  const deletePayment = useDeleteInvoicePayment()

  const [clientId, setClientId] = useState('')
  const [editingPayment, setEditingPayment] = useState<InvoicePayment | null>(null)

  const invoiceOf = (p: InvoicePayment) => invoices?.find((i) => i.id === p.invoice_id)
  const clientOf = (p: InvoicePayment) => {
    const invoice = invoiceOf(p)
    return invoice ? clients?.find((c) => c.id === invoice.client_id) : undefined
  }
  const invoiceLabelOf = (p: InvoicePayment) => {
    const invoice = invoiceOf(p)
    return invoice ? invoice.display_id ?? invoice.invoice_number ?? '—' : '—'
  }

  const clientFiltered = clientId ? (payments ?? []).filter((p) => clientOf(p)?.id === clientId) : payments

  const { sorted: sortedPayments, sortKey, direction, toggleSort } = useSort(
    clientFiltered,
    {
      id: (p) => p.display_id,
      date: (p) => p.date,
      client: (p) => clientLabel(clientOf(p)),
      invoice: (p) => invoiceLabelOf(p),
      amount: (p) => p.amount,
    },
    'date'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedPayments)

  const exportSections: ExportSection[] = [
    {
      title: 'Payment records',
      columns: ['ID', 'Date', 'Client', 'Against invoice', 'Amount', 'Reference', 'Payment mode'],
      rows: (sortedPayments ?? []).map((p) => [
        p.display_id ?? '',
        fmtDate(p.date),
        clientLabel(clientOf(p)),
        invoiceLabelOf(p),
        p.amount,
        p.reference ?? '',
        p.payment_mode ?? '',
      ]),
    },
  ]

  return (
    <details className="toggle-section">
      <summary>Payment records</summary>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label>Search client</label>
          <SearchableSelect
            items={clients}
            value={clientId}
            onChange={setClientId}
            getId={(c) => c.id}
            getLabel={(c) => clientLabel(c)}
            placeholder="— All clients —"
          />
        </div>
        <ReportExportButtons title="Payment records" sections={exportSections} range={null} style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client" sortKey="client" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Against invoice" sortKey="invoice" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th>Reference</th>
              <th>Payment mode</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={COL_SPAN} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedPayments || sortedPayments.length === 0) && (
              <tr>
                <td colSpan={COL_SPAN} className="empty-row">
                  No payments recorded
                </td>
              </tr>
            )}
            {pageRows?.map((p) => {
              const client = clientOf(p)
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.display_id ?? '—'}</td>
                    <td>{fmtDate(p.date)}</td>
                    <td>{clientLabel(client)}</td>
                    <td>{invoiceLabelOf(p)}</td>
                    <td className="amt">{fmt(p.amount)}</td>
                    <td>{p.reference ?? '—'}</td>
                    <td>{p.payment_mode ?? '—'}</td>
                    <td>
                      <RowMenu
                        items={[
                          { label: 'Edit', onClick: () => setEditingPayment(p) },
                          { label: 'Remove', onClick: () => deletePayment.mutate(p.id) },
                        ]}
                      />
                    </td>
                  </tr>
                  {editingPayment?.id === p.id && (
                    <tr className="pay-form-row">
                      <td colSpan={COL_SPAN}>
                        <EditInvoicePaymentFields payment={editingPayment} onClose={() => setEditingPayment(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
