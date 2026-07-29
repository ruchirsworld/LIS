import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients, useProjects } from '../../lib/queries/masters'
import { useCreateInvoice, useUpdateInvoice } from '../../lib/queries/invoices'
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
}: {
  editingInvoice: Invoice | null
  onDoneEditing: () => void
}) {
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amount, setAmount] = useState('0')
  const [gstPct, setGstPct] = useState('0')
  const [tdsPct, setTdsPct] = useState('0')
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
    setDueDays('')
    setStatus('draft')
    setInvoiceDate('')
  }

  function handleClientChange(id: string) {
    setClientId(id)
    const proj = projects?.find((p) => p.id === projectId)
    if (id && proj?.client_id !== id) setProjectId('')
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
    setSubmitting(true)
    try {
      const patch = {
        client_id: clientId,
        project_id: projectId || null,
        invoice_number: invoiceNumber.trim() || null,
        amount: parseINR(amount),
        gst_pct: Number(gstPct) || 0,
        tds_pct: Number(tdsPct) || 0,
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

  return (
    <details className="toggle-section" open>
      <summary>Invoices</summary>

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
              onChange={setProjectId}
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
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
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
    </details>
  )
}
