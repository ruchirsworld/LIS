import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients, useProjects } from '../../lib/queries/masters'
import { useInvoices, useCreateInvoice, useUpdateInvoice } from '../../lib/queries/invoices'
import { parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function InvoiceForm({
  editingInvoice,
  onDoneEditing,
  inModal = false,
}: {
  editingInvoice: Invoice | null
  onDoneEditing: () => void
  /** Shown inside a popup: without the section heading around it. */
  inModal?: boolean
}) {
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const { data: existingInvoices } = useInvoices(null)

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amount, setAmount] = useState('0')
  const [gstPct, setGstPct] = useState('0')
  const [tdsPct, setTdsPct] = useState('0')
  const [retentionPct, setRetentionPct] = useState('0')
  const [retentionReleaseDate, setRetentionReleaseDate] = useState('')
  const [hsnSac, setHsnSac] = useState('')
  const [gstOnHold, setGstOnHold] = useState(false)
  const [description, setDescription] = useState('')
  const [dueDays, setDueDays] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent'>('draft')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const visibleProjects = projects?.filter((p) => p.status === 'active' && (!clientId || p.client_id === clientId))

  useEffect(() => {
    if (!editingInvoice) return
    setClientId(editingInvoice.client_id)
    setProjectId(editingInvoice.project_id ?? '')
    setInvoiceNumber(editingInvoice.invoice_number ?? '')
    setAmount(String(editingInvoice.amount))
    setGstPct(String(editingInvoice.gst_pct ?? 0))
    setTdsPct(String(editingInvoice.tds_pct ?? 0))
    setRetentionPct(String(editingInvoice.retention_pct ?? 0))
    setRetentionReleaseDate(editingInvoice.retention_release_date ?? '')
    setHsnSac(editingInvoice.hsn_sac ?? '')
    setGstOnHold(!!editingInvoice.gst_on_hold)
    setDescription(editingInvoice.description ?? '')
    setDueDays(editingInvoice.due_days != null ? String(editingInvoice.due_days) : '')
    setStatus(editingInvoice.status)
    setInvoiceDate(editingInvoice.invoice_date ?? '')
    setFormError(null)
  }, [editingInvoice])

  function resetForm() {
    setClientId('')
    setProjectId('')
    setInvoiceNumber('')
    setAmount('0')
    setGstPct('0')
    setTdsPct('0')
    setRetentionPct('0')
    setRetentionReleaseDate('')
    setHsnSac('')
    setGstOnHold(false)
    setDescription('')
    setDueDays('')
    setStatus('draft')
    setInvoiceDate('')
  }

  function handleClientChange(id: string) {
    setClientId(id)
    if (!editingInvoice) setGstOnHold(!!clients?.find((c) => c.id === id)?.gst_on_proof)
    const proj = projects?.find((p) => p.id === projectId)
    if (id && proj?.client_id !== id) setProjectId('')
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    const proj = projects?.find((p) => p.id === id)
    if (proj) {
      setClientId(proj.client_id)
      if (!editingInvoice) setGstOnHold(!!clients?.find((c) => c.id === proj.client_id)?.gst_on_proof)
    }
  }

  function handleStatusChange(next: 'draft' | 'sent') {
    setStatus(next)
    if (next === 'sent' && !invoiceDate) setInvoiceDate(todayStr())
  }

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!clientId) {
      setFormError('Pick a client.')
      return
    }
    // GST Rule 46: a tax invoice number is unique, at most 16 characters, and
    // uses only letters, digits, "/" and "-".
    const number = invoiceNumber.trim()
    if (status === 'sent' && !number) {
      setFormError('A sent invoice needs an invoice number.')
      return
    }
    if (number) {
      if (number.length > 16) {
        setFormError(`The invoice number is ${number.length} characters — GST allows at most 16.`)
        return
      }
      if (!/^[A-Za-z0-9/-]+$/.test(number)) {
        setFormError('Use only letters, digits, "/" and "-" in the invoice number.')
        return
      }
      const clash = (existingInvoices ?? []).find(
        (i) => i.id !== editingInvoice?.id && (i.invoice_number ?? '').trim().toLowerCase() === number.toLowerCase()
      )
      if (clash) {
        setFormError(`Invoice number ${number} is already used (${clash.display_id ?? 'another invoice'}) — each tax invoice needs its own.`)
        return
      }
    }
    if (hsnSac.trim() && !/^\d{4}(\d{2}(\d{2})?)?$/.test(hsnSac.trim())) {
      setFormError('The HSN / SAC code is 4, 6 or 8 digits (for construction and landscaping services it starts with 99).')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        client_id: clientId,
        project_id: projectId || null,
        invoice_number: invoiceNumber.trim() || null,
        amount: parseINR(amount),
        gst_pct: Number(gstPct) || 0,
        tds_pct: Number(tdsPct) || 0,
        retention_pct: Number(retentionPct) || 0,
        retention_release_date: Number(retentionPct) > 0 ? retentionReleaseDate || null : null,
        hsn_sac: hsnSac.trim() || null,
        gst_on_hold: gstOnHold,
        description: description.trim() || null,
        due_days: dueDays ? Number(dueDays) : null,
        status,
        invoice_date: status === 'sent' ? invoiceDate || todayStr() : null,
      }
      if (editingInvoice) {
        await updateInvoice.mutateAsync({ id: editingInvoice.id, patch })
        onDoneEditing()
      } else {
        await createInvoice.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save invoice.'))
    } finally {
      setSubmitting(false)
    }
  }

  const body = (
    <>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Client, Project */}
        <div className="field-row inv-row1">
          <div className="field inv-client">
            <label>Client</label>
            <SearchableSelect
              items={clients}
              value={clientId}
              onChange={handleClientChange}
              getId={(c) => c.id}
              getLabel={(c) => clientLabel(c)}
              placeholder="— Select client —"
            />
          </div>
          <div className="field inv-project">
            <label>Project</label>
            <SearchableSelect
              items={visibleProjects}
              value={projectId}
              onChange={handleProjectChange}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— No specific project —"
            />
          </div>
        </div>

        {/* Row 2: Invoice No, Invoice date (auto-set the first time status becomes Sent) */}
        <div className="field-row inv-row2">
          <div className="field inv-invoice-number">
            <label>Invoice no.</label>
            <input type="text" maxLength={16} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            <div className="note">Unique, up to 16 characters: letters, digits, / and -</div>
          </div>
          <div className="field inv-invoice-date">
            <label>Invoice date</label>
            {status === 'sent' ? (
              <input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            ) : (
              <input type="text" value="— (not sent yet)" disabled />
            )}
          </div>
        </div>

        {/* Row 2b: what the invoice is for — printed on the tax invoice */}
        <div className="field-row">
          <div className="field field-narrow">
            <label>HSN / SAC code</label>
            <input type="text" inputMode="numeric" maxLength={8} placeholder="e.g. 995419" value={hsnSac} onChange={(e) => setHsnSac(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="field">
            <label>Description of services</label>
            <input type="text" placeholder="e.g. Horticulture and landscaping work, RA bill no. 1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Row 3: Amount, Due in (days) */}
        <div className="field-row inv-row3">
          <div className="field inv-amount">
            <label>Amount (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} required />
          </div>
          <div className="field inv-due-days">
            <label>Due in (days)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 30"
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
            />
          </div>
        </div>

        {/* Row 4: GST, TDS */}
        <div className="field-row inv-row4">
          <div className="field inv-gst">
            <label>GST %</label>
            <input type="number" min="0" step="0.01" value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
          </div>
          <div className="field inv-tds">
            <label>TDS %</label>
            <input type="number" min="0" step="0.01" value={tdsPct} onChange={(e) => setTdsPct(e.target.value)} />
          </div>
        </div>

        {/* Row 4b: Retention % — held back by the client for a period, not
            counted as due/overdue until released — and the date it is due to
            be released. */}
        <div className="field-row">
          <div className="field field-narrow">
            <label>Retention %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={retentionPct}
              onChange={(e) => setRetentionPct(e.target.value)}
            />
          </div>
          {Number(retentionPct) > 0 && (
            <div className="field field-narrow">
              <label>Retention release date</label>
              <input type="date" value={retentionReleaseDate} onChange={(e) => setRetentionReleaseDate(e.target.value)} />
            </div>
          )}
        </div>

        {/* The client releases the GST only after proof of deposit (GSTR-3B). */}
        <div className="field full">
          <label className="check-inline">
            <input type="checkbox" checked={gstOnHold} onChange={(e) => setGstOnHold(e.target.checked)} />
            Client releases the GST only after GSTR-3B proof
          </label>
          <div className="note">The GST then stays out of Due and "overdue" until the client releases it. You track the filing and the proof on the invoice.</div>
        </div>

        {/* Row 5: Status, Add invoice */}
        <div className="field-row inv-row5">
          <div className="field inv-status">
            <label>Status</label>
            <select value={status} onChange={(e) => handleStatusChange(e.target.value as typeof status)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </select>
          </div>
          <div className="field inv-submit">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editingInvoice ? 'Save changes' : 'Add invoice'}
              </Button>
              {editingInvoice && (
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </>
  )

  return inModal ? (
    <div>{body}</div>
  ) : (
    <details className="toggle-section" open>
      <summary>Invoices</summary>
      {body}
    </details>
  )
}
