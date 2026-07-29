import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { useClients } from '../../lib/queries/masters'
import { useCreateClient, useUpdateClient, useDeleteClient } from '../../lib/queries/admin'

export function ClientsSection() {
  const { data: clients, isLoading } = useClients()
  const { sorted: sortedClients, sortKey, direction, toggleSort } = useSort(clients, {
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
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedClients)
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [clientCode, setClientCode] = useState('')
  const [gst, setGst] = useState('')
  const [email, setEmail] = useState('')
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
  }

  function startEdit(c: NonNullable<typeof clients>[number]) {
    setEditingId(c.id)
    setName(c.name)
    setAddressLine1(c.address_line1 ?? '')
    setCity(c.city ?? '')
    setState(c.state ?? '')
    setPincode(c.pincode ?? '')
    setClientCode(c.client_code ?? '')
    setGst(c.gst ?? '')
    setEmail(c.email ?? '')
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
      }
      if (editingId) {
        await updateClient.mutateAsync({ id: editingId, patch })
      } else {
        await createClient.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save client.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Clients</summary>

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

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
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
                <td colSpan={10} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!clients || clients.length === 0) && (
              <tr>
                <td colSpan={10} className="empty-row">
                  No clients yet — add your first one above
                </td>
              </tr>
            )}
            {pageRows?.map((c) => (
              <tr key={c.id}>
                <td>{c.display_id ?? '—'}</td>
                <td>{c.name}</td>
                <td>{c.client_code ?? '—'}</td>
                <td>{c.address_line1 ?? '—'}</td>
                <td>{c.city ?? '—'}</td>
                <td>{c.state ?? '—'}</td>
                <td>{c.pincode ?? '—'}</td>
                <td>{c.gst ?? '—'}</td>
                <td>{c.email ?? '—'}</td>
                <td>
                  <button type="button" className="pay-btn" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button type="button" className="btn danger-link" onClick={() => deleteClient.mutate(c.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
