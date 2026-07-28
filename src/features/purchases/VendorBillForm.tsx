import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useClients, useProjects, useVendors } from '../../lib/queries/masters'
import { useCreateVendorBill } from '../../lib/queries/purchases'
import { fmt, parseINR } from '../../lib/calc/format'
import { billTotal } from '../../lib/calc/vendorBills'
import { compressImage } from '../../lib/compressImage'
import { uploadReceipt } from '../../lib/storage'
import { clientLabel } from '../../lib/labels'
import { VendorCombobox } from './VendorCombobox'
import { useVendorCategoryFilter, VendorCategoryPills } from './VendorCategoryFilter'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function VendorBillForm() {
  const { profile } = useAuth()
  const canAddVendor = profile?.role === 'admin' || profile?.role === 'cxo'
  const { data: vendors } = useVendors()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const createVendorBill = useCreateVendorBill()

  const [vendorId, setVendorId] = useState('')
  const { categories: vendorCategories, category: vendorCategory, setCategory: setVendorCategory, filteredVendors } =
    useVendorCategoryFilter(vendors, () => setVendorId(''))
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [gstPct, setGstPct] = useState('0')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const visibleProjects = clientId ? projects?.filter((p) => p.client_id === clientId) : projects

  function handleClientChange(id: string) {
    setClientId(id)
    const proj = projects?.find((p) => p.id === projectId)
    if (id && proj?.client_id !== id) setProjectId('')
  }

  async function handleReceiptFile(file: File) {
    setReceiptStatus('Processing photo…')
    try {
      const blob = await compressImage(file)
      setReceiptBlob(blob)
      setReceiptStatus('Photo attached')
    } catch {
      setReceiptStatus('Could not process photo')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!vendorId) {
      setFormError('Pick a vendor.')
      return
    }
    setSubmitting(true)
    try {
      let receiptPath: string | null = null
      if (receiptBlob) {
        receiptPath = await uploadReceipt(receiptBlob, 'vendor_bills')
      }

      await createVendorBill.mutateAsync({
        vendor_id: vendorId,
        description: description.trim() || null,
        client_id: clientId || null,
        project_id: projectId || null,
        date,
        amount: parseINR(amount),
        gst_pct: Number(gstPct) || 0,
        receipt_path: receiptPath,
      })
      setVendorId('')
      setVendorCategory(null)
      setDescription('')
      setClientId('')
      setProjectId('')
      setDate(todayStr())
      setAmount('0')
      setGstPct('0')
      setReceiptBlob(null)
      setReceiptStatus('Take photo')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add bill.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>Vendor bills</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full vb-vendor">
          <label>Vendor type</label>
          <VendorCategoryPills categories={vendorCategories} category={vendorCategory} onChange={setVendorCategory} />
          <label>Vendor</label>
          <VendorCombobox vendors={filteredVendors} value={vendorId} onChange={setVendorId} allowCreate={canAddVendor} />
        </div>

        <div className="field-row">
          <div className="field field-narrow">
            <label>Bill date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Bill description</label>
            <input
              type="text"
              placeholder="e.g. plant stock, hardscape material"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="optional-row">
          <div className="field">
            <label>Client (optional)</label>
            <SearchableSelect
              items={clients}
              value={clientId}
              onChange={handleClientChange}
              getId={(c) => c.id}
              getLabel={(c) => clientLabel(c)}
              placeholder="— No client / general —"
            />
          </div>
          <div className="field">
            <label>Project (optional)</label>
            <SearchableSelect
              items={visibleProjects}
              value={projectId}
              onChange={setProjectId}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— No project / general —"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Bill value (₹)</label>
            <CurrencyInput value={amount} onValueChange={setAmount} required />
          </div>
          <div className="field">
            <label>GST %</label>
            <input type="number" min="0" step="0.01" value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
          </div>
          <div className="field row-inline" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
            <ReceiptUploadButton
              idPrefix="vb-receipt"
              hasFile={!!receiptBlob}
              status={receiptStatus}
              onFile={handleReceiptFile}
            />
          </div>
        </div>
        {receiptStatus === 'Could not process photo' && (
          <div className="field full">
            <div className="note" style={{ color: 'var(--red)', marginTop: -6 }}>
              Could not process that photo — try again.
            </div>
          </div>
        )}

        <div className="field-row vb-row5">
          <div className="field vb-total">
            <label>Total value (₹)</label>
            <input type="text" readOnly value={fmt(billTotal({ amount: parseINR(amount), gst_pct: Number(gstPct) || 0 }))} />
          </div>
          <div className="field vb-submit">
            <label>&nbsp;</label>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add bill'}
            </Button>
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
