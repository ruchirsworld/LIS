import { activateProps } from '../../lib/a11y'
import { Fragment, useEffect, useRef, useState } from 'react'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { useNavFilter } from '../../lib/navContext'
import type { DateRange } from '../../lib/calc/period'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'
import { confirmAction } from '../../lib/feedback'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useInvoices, useInvoicePayments, useDeleteInvoicePayment } from '../../lib/queries/invoices'
import { useClients } from '../../lib/queries/masters'
import { fmt, fmtDate } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import { EditInvoicePaymentFields } from './InvoicePaymentForm'
import type { Database } from '../../types/database'

type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']

const COL_SPAN = 9

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
  const openRows = useOpenRows()
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange | null>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const nav = useNavFilter('receipts')
  // A "Revenue received" drill-through lands here with the dashboard's period
  // preset — open the section so it is actually seen.
  useEffect(() => {
    if (nav?.filter.range && detailsRef.current) detailsRef.current.open = true
  }, [nav])
  const [editingPayment, setEditingPayment] = useState<InvoicePayment | null>(null)

  async function removePayment(p: InvoicePayment) {
    const ok = await confirmAction({
      title: 'Delete receipt',
      message: `Delete receipt ${p.display_id ?? ''} of ${fmt(p.amount)} dated ${fmtDate(p.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deletePayment.mutate(p.id)
  }

  const invoiceOf = (p: InvoicePayment) => invoices?.find((i) => i.id === p.invoice_id)
  const clientOf = (p: InvoicePayment) => {
    const invoice = invoiceOf(p)
    return invoice ? clients?.find((c) => c.id === invoice.client_id) : undefined
  }
  const invoiceLabelOf = (p: InvoicePayment) => {
    const invoice = invoiceOf(p)
    return invoice ? invoice.display_id ?? invoice.invoice_number ?? '—' : '—'
  }

  const clientFiltered = (clientId ? (payments ?? []).filter((p) => clientOf(p)?.id === clientId) : payments)?.filter(
    (p) => (!range?.from || p.date >= range.from) && (!range?.to || p.date <= range.to)
  )

  const searchedPayments = search
    ? clientFiltered?.filter((p) =>
        matchesSearch(search, [p.display_id, p.reference, p.date, p.amount, p.payment_mode, invoiceLabelOf(p), invoiceOf(p)?.invoice_number, clientLabel(clientOf(p)), p.is_retention_release ? 'retention release' : ''])
      )
    : clientFiltered

  const { sorted: sortedPayments, sortKey, direction, toggleSort } = useSort(
    searchedPayments,
    {
      id: (p) => p.display_id,
      date: (p) => p.date,
      client: (p) => clientLabel(clientOf(p)),
      invoice: (p) => invoiceLabelOf(p),
      amount: (p) => p.amount,
    },
    'date'
  )
  // Rows that belong to one split receipt (same receipt_id) sit together as a
  // single line at the position of the first of them, expandable to the
  // per-invoice rows. Everything else stays one row each.
  const entries: { key: string; payments: InvoicePayment[] }[] = []
  const byReceipt = new Map<string, { key: string; payments: InvoicePayment[] }>()
  for (const p of sortedPayments ?? []) {
    const existing = p.receipt_id ? byReceipt.get(p.receipt_id) : undefined
    if (existing) {
      existing.payments.push(p)
      continue
    }
    const entry = { key: p.receipt_id ?? p.id, payments: [p] }
    entries.push(entry)
    if (p.receipt_id) byReceipt.set(p.receipt_id, entry)
  }
  const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(new Set())
  function toggleReceipt(key: string) {
    setExpandedReceipts((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(entries, search)

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
    <details className="toggle-section" id="inv-payments" ref={detailsRef}>
      <summary>Payment records</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle
            range={range}
            onChange={setRange}
            preset={nav?.filter.range ? { ...nav.filter.range, nonce: nav.nonce } : undefined}
          />
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
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Payment records" sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
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
            {pageRows?.map((entry) => {
              const renderRow = (p: InvoicePayment, nested: boolean) => (
                <RecordRow
                  key={p.id}
                  expanded={openRows.isOpen(p.id)}
                  onToggle={() => openRows.toggle(p.id)}
                  colSpan={COL_SPAN}
                  details={<RecordDetails sourceTable="invoice_payments" sourceId={p.id} />}
                  onEdit={() => setEditingPayment(p)}
                  onDelete={() => void removePayment(p)}
                >
                  <td style={nested ? { paddingLeft: 28 } : undefined}>{p.display_id ?? '—'}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{clientLabel(clientOf(p))}</td>
                  <td>{invoiceLabelOf(p)}</td>
                  <td className="amt">{fmt(p.amount)}</td>
                  <td>{p.reference ?? '—'}</td>
                  <td>{p.payment_mode ?? '—'}</td>
                </RecordRow>
              )

              if (entry.payments.length === 1) return renderRow(entry.payments[0], false)

              const group = [...entry.payments].sort((x, y) => (x.display_id ?? '').localeCompare(y.display_id ?? '', undefined, { numeric: true }))
              const first = group[0]
              const total = group.reduce((sum, p) => sum + Number(p.amount || 0), 0)
              const open = expandedReceipts.has(entry.key)
              return (
                <Fragment key={entry.key}>
                  <tr className="row-link" {...activateProps(() => toggleReceipt(entry.key))} aria-expanded={open}>
                    <td style={{ width: 36 }}>
                      <button
                        type="button"
                        className="row-expand-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleReceipt(entry.key)
                        }}
                        aria-label={open ? 'Hide the receipts' : 'Show the receipts'}
                      >
                        {open ? '▾' : '▸'}
                      </button>
                    </td>
                    <td>
                      {first.display_id} – {group[group.length - 1].display_id}
                    </td>
                    <td>{fmtDate(first.date)}</td>
                    <td>{clientLabel(clientOf(first))}</td>
                    <td>Split across {group.length} invoices</td>
                    <td className="amt">{fmt(total)}</td>
                    <td>{first.reference ?? '—'}</td>
                    <td>{first.payment_mode ?? '—'}</td>
                    <td></td>
                  </tr>
                  {open && group.map((p) => renderRow(p, true))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editingPayment && (
        <Modal title={`Edit receipt ${editingPayment.display_id ?? ''}`} onClose={() => setEditingPayment(null)}>
          <EditInvoicePaymentFields payment={editingPayment} onClose={() => setEditingPayment(null)} />
        </Modal>
      )}
    </details>
  )
}
