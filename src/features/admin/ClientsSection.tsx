import { useState, type FormEvent } from 'react'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { confirmAction } from '../../lib/feedback'
import { RecordDetails } from '../reports/RecordDetailModal'
import { Button } from '../../components/ui'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useClients } from '../../lib/queries/masters'
import { useCreateClient, useUpdateClient, useDeleteClient } from '../../lib/queries/admin'
import { useSetClientGstHold } from '../../lib/queries/books'
import { getErrorMessage } from '../../lib/errors'

export function ClientsSection() {
  const { data: clients, isLoading } = useClients()
  const [search, setSearch] = useState('')
  const searched = search ? clients?.filter((r) => matchesSearch(search, Object.values(r))) : clients
  const { sorted: sortedClients, sortKey, direction, toggleSort } = useSort(searched, {
    id: (c) => c.display_id,
    name: (c) => c.name,
    code: (c) => c.client_code,
    address: (c) => c.address_line1,
    city: (c) => c.city,
    state: (c) => c.state,
    pincode: (c) => c.pincode,
    gst: (c) => c.gst,
    email: (c) => c.email,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedClients, search)
  const exportSections: ExportSection[] = [
    {
      title: 'Clients',
      columns: ['ID', 'Client', 'Client code', 'Address', 'City', 'State', 'Pin code', 'GST', 'Email'],
      rows: (sortedClients ?? []).map((c) => [
        c.display_id ?? '',
        c.name,
        c.client_code ?? '',
        c.address_line1 ?? '',
        c.city ?? '',
        c.state ?? '',
        c.pincode ?? '',
        c.gst ?? '',
        c.email ?? '',
      ]),
    },
  ]
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const setHold = useSetClientGstHold()
  const deleteClient = useDeleteClient()
  const openRows = useOpenRows()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [clientCode, setClientCode] = useState('')
  const [gst, setGst] = useState('')
  const [email, setEmail] = useState('')
  const [gstOnProof, setGstOnProof] = useState(false)
  const [applyToExisting, setApplyToExisting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setAddressLine1('')
    setCity('')
    setState('')
    setPincode('')
    setClientCode('')
    setGst('')
    setEmail('')
    setGstOnProof(false)
    setApplyToExisting(false)
  }

  async function removeClient(c: NonNullable<typeof clients>[number]) {
    const ok = await confirmAction({
      title: 'Delete client',
      message: `Delete ${c.name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteClient.mutate(c.id)
  }

  function startEdit(c: NonNullable<typeof clients>[number]) {
    setFormOpen(true)
    setEditingId(c.id)
    setName(c.name)
    setAddressLine1(c.address_line1 ?? '')
    setCity(c.city ?? '')
    setState(c.state ?? '')
    setPincode(c.pincode ?? '')
    setClientCode(c.client_code ?? '')
    setGst(c.gst ?? '')
    setEmail(c.email ?? '')
    setGstOnProof(!!c.gst_on_proof)
    setApplyToExisting(false)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Client name is required.')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        name: name.trim(),
        address_line1: addressLine1.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pincode: pincode.trim() || null,
        client_code: clientCode.trim() || null,
        gst: gst.trim() || null,
        email: email.trim() || null,
        gst_on_proof: gstOnProof,
      }
      if (editingId) {
        await updateClient.mutateAsync({ id: editingId, patch })
        if (applyToExisting) await setHold.mutateAsync({ clientId: editingId, hold: gstOnProof })
      } else {
        await createClient.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save client.'))
    } finally {
      setSubmitting(false)
    }
  }

  const formBody = (
    <>
      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Client name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field full">
          <label>Address line 1</label>
          <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>State</label>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
        </div>
        <div className="field field-narrow">
          <label>Pin code</label>
          <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} />
        </div>
        <div className="field-row cl-row">
          <div className="field cl-code">
            <label>Client code</label>
            <input type="text" value={clientCode} onChange={(e) => setClientCode(e.target.value)} />
          </div>
          <div className="field cl-gst">
            <label>GST number</label>
            <input
              type="text"
              placeholder="e.g. 07ABCDE1234F1Z5"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field full">
          <label className="check-inline">
            <input type="checkbox" checked={gstOnProof} onChange={(e) => setGstOnProof(e.target.checked)} />
            Releases GST only after we file GSTR-3B and send proof
          </label>
          <div className="note">
            For clients that pay the taxable value first and the GST later: their GST stays out of Due and "overdue" until released. New invoices
            for this client start on that footing.
          </div>
          {editingId && (
            <label className="check-inline" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
              Also {gstOnProof ? 'switch on' : 'switch off'} for this client's existing invoices
            </label>
          )}
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add client'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )

  return (
    <details className="toggle-section">
      <summary>Clients</summary>

      {!editingId && (
        <details className="toggle-section" style={{ marginTop: 16 }} open={formOpen} onToggle={(e) => setFormOpen(e.currentTarget.open)}>
          <summary>Add new client</summary>
          {formBody}
        </details>
      )}
      {editingId && (
        <Modal title="Edit client" onClose={resetForm}>
          {formBody}
        </Modal>
      )}

      <details className="toggle-section" style={{ marginTop: 12 }} open>
        <summary>Client list</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Clients" sections={exportSections} range={null} iconOnly style={{ marginTop: 0 }} />
      </div>
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client code" sortKey="code" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Address" sortKey="address" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="City" sortKey="city" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="State" sortKey="state" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Pin code" sortKey="pincode" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="GST" sortKey="gst" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Email" sortKey="email" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!clients || clients.length === 0) && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No clients yet — add your first one above
                </td>
              </tr>
            )}
            {pageRows?.map((c) => (
              <RecordRow
                key={c.id}
                expanded={openRows.isOpen(c.id)}
                onToggle={() => openRows.toggle(c.id)}
                colSpan={11}
                details={<RecordDetails sourceTable="clients" sourceId={c.id} />}
                onEdit={() => startEdit(c)}
                onDelete={() => void removeClient(c)}
              >
                <td>{c.display_id ?? '—'}</td>
                <td>{c.name}</td>
                <td>{c.client_code ?? '—'}</td>
                <td>{c.address_line1 ?? '—'}</td>
                <td>{c.city ?? '—'}</td>
                <td>{c.state ?? '—'}</td>
                <td>{c.pincode ?? '—'}</td>
                <td>{c.gst ?? '—'}</td>
                <td>{c.email ?? '—'}</td>
              </RecordRow>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
      </details>
    </details>
  )
}
