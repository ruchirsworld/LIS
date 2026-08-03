import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useClients, useProjects, useVendors } from '../../lib/queries/masters'
import { useCreateVendorBill, useUpdateVendorBill } from '../../lib/queries/purchases'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { billTotal } from '../../lib/calc/vendorBills'
import { compressImage } from '../../lib/compressImage'
import { uploadReceiptToDrive } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel } from '../../lib/labels'
import { VendorCombobox } from './VendorCombobox'
import { useVendorCategoryFilter, VendorCategoryPills } from './VendorCategoryFilter'
import type { Database } from '../../types/database'

type VendorBill = Database['public']['Tables']['vendor_bills']['Row']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// e.g. Ref ID "Bill/23" + Bill date 2026-08-03 -> "Ven-03-08-2026-Bill23.jpg"
function receiptFileName(displayId: string | null, dateStr: string): string {
  const refId = (displayId ?? 'unknown').replace(/\//g, '')
  return `Ven-${fmtDate(dateStr)}-${refId}.jpg`
}

export function VendorBillForm({
  editingBill,
  onDoneEditing,
}: {
  editingBill: VendorBill | null
  onDoneEditing: () => void
}) {
  const { profile } = useAuth()
  const canAddVendor = profile?.role === 'admin' || profile?.role === 'cxo'
  const { data: vendors } = useVendors()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const createVendorBill = useCreateVendorBill()
  const updateVendorBill = useUpdateVendorBill()

  const [vendorId, setVendorId] = useState('')
  const { categories: vendorCategories, category: vendorCategory, setCategory: setVendorCategory, filteredVendors } =
    useVendorCategoryFilter(vendors, () => setVendorId(''))
  const [description, setDescription] = useState('')
  const [remarks, setRemarks] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [gstPct, setGstPct] = useState('0')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('0')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const visibleProjects = clientId ? projects?.filter((p) => p.client_id === clientId) : projects
  const selectedVendor = vendors?.find((v) => v.id === vendorId)
  const isMenPower = selectedVendor?.category === 'MenPower'

  useEffect(() => {
    if (!editingBill) return
    setVendorId(editingBill.vendor_id)
    setDescription(editingBill.description ?? '')
    setRemarks(editingBill.remarks ?? '')
    setClientId(editingBill.client_id ?? '')
    setProjectId(editingBill.project_id ?? '')
    setDate(editingBill.date ?? todayStr())
    setAmount(String(editingBill.amount))
    setGstPct(String(editingBill.gst_pct ?? 0))
    setQty(editingBill.qty != null ? String(editingBill.qty) : '')
    setRate(editingBill.rate != null ? String(editingBill.rate) : '0')
    setReceiptBlob(null)
    setReceiptStatus(editingBill.receipt_path ? 'Photo attached' : 'Take photo')
    setFormError(null)
  }, [editingBill])

  function resetForm() {
    setVendorId('')
    setVendorCategory(null)
    setDescription('')
    setRemarks('')
    setClientId('')
    setProjectId('')
    setDate(todayStr())
    setAmount('0')
    setGstPct('0')
    setQty('')
    setRate('0')
    setReceiptBlob(null)
    setReceiptStatus('Take photo')
  }

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

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
    if (isMenPower && (!qty || Number(qty) <= 0)) {
      setFormError('Enter a quantity.')
      return
    }
    setSubmitting(true)
    try {
      const basePatch = {
        vendor_id: vendorId,
        description: description.trim() || null,
        remarks: remarks.trim() || null,
        client_id: clientId || null,
        project_id: projectId || null,
        date,
        amount: isMenPower ? (Number(qty) || 0) * parseINR(rate) : parseINR(amount),
        gst_pct: isMenPower ? 0 : Number(gstPct) || 0,
        qty: isMenPower ? Number(qty) || 0 : null,
        rate: isMenPower ? parseINR(rate) : null,
      }

      if (editingBill) {
        // Ref ID is already known, so a new photo can be uploaded before the single update.
        let receiptPath: string | null = editingBill.receipt_path ?? null
        if (receiptBlob) {
          receiptPath = await uploadReceiptToDrive(receiptBlob, receiptFileName(editingBill.display_id, date))
        }
        await updateVendorBill.mutateAsync({ id: editingBill.id, patch: { ...basePatch, receipt_path: receiptPath } })
        onDoneEditing()
      } else {
        // Ref ID is only assigned on insert, so create the row first, then upload, then attach the path.
        const created = await createVendorBill.mutateAsync({ ...basePatch, receipt_path: null })
        if (receiptBlob) {
          const receiptPath = await uploadReceiptToDrive(receiptBlob, receiptFileName(created.display_id, date))
          await updateVendorBill.mutateAsync({ id: created.id, patch: { receipt_path: receiptPath } })
        }
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save bill.'))
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
          {isMenPower ? (
            <>
              <div className="field">
                <label>MenPower qty</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Rate (₹)</label>
                <CurrencyInput value={rate} onValueChange={setRate} required />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Bill value (₹)</label>
                <CurrencyInput value={amount} onValueChange={setAmount} required />
              </div>
              <div className="field">
                <label>GST %</label>
                <input type="number" min="0" step="0.01" value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
              </div>
            </>
          )}
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

        <div className="field full">
          <label>Remarks (optional)</label>
          <input
            type="text"
            placeholder="Any extra context"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div className="field-row vb-row5">
          <div className="field vb-total">
            <label>Total value (₹)</label>
            <input
              type="text"
              readOnly
              value={
                isMenPower
                  ? fmt((Number(qty) || 0) * parseINR(rate))
                  : fmt(billTotal({ amount: parseINR(amount), gst_pct: Number(gstPct) || 0 }))
              }
            />
          </div>
          <div className="field vb-submit">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editingBill ? 'Save changes' : 'Add bill'}
              </Button>
              {editingBill && (
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
