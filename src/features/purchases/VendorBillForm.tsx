import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useClients, useProjects, useVendors } from '../../lib/queries/masters'
import { useCreateVendorBill, useUpdateVendorBill, useCreateVendorBillPayment } from '../../lib/queries/purchases'
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
type PaymentMode = 'UPI' | 'NEFT' | 'Cash'

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'NEFT', 'Cash']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// e.g. Ref ID "Bill/23" + Bill date 2026-08-03 -> "Ven-03-08-2026-Bill23.jpg"
function receiptFileName(displayId: string | null, dateStr: string): string {
  const refId = (displayId ?? 'unknown').replace(/\//g, '')
  return `Ven-${fmtDate(dateStr)}-${refId}.jpg`
}

function IdBadge({ id }: { id: string | null }) {
  return (
    <span
      style={{
        background: 'var(--red-soft)',
        color: 'var(--red)',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      Saved as {id}
    </span>
  )
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
  const createVendorBillPayment = useCreateVendorBillPayment()

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
  const [otherCost, setOtherCost] = useState('0')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [lastCreatedBill, setLastCreatedBill] = useState<VendorBill | null>(null)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const [payDate, setPayDate] = useState(todayStr())
  const [payAmount, setPayAmount] = useState('0')
  const [payMode, setPayMode] = useState<PaymentMode>('UPI')
  const [payError, setPayError] = useState<string | null>(null)
  const [payDone, setPayDone] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)

  const activeProjects = projects?.filter((p) => p.status === 'active')
  const selectedProject = projects?.find((p) => p.id === projectId)
  const selectedProjectClient = selectedProject ? clients?.find((c) => c.id === selectedProject.client_id) : null
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
    setOtherCost(editingBill.other_cost != null ? String(editingBill.other_cost) : '0')
    setReceiptBlob(null)
    setReceiptStatus(editingBill.receipt_path ? 'Photo attached' : 'Take photo')
    setFormError(null)
    setLastCreatedBill(null)
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
    setOtherCost('0')
    setReceiptBlob(null)
    setReceiptStatus('Take photo')
  }

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    const proj = activeProjects?.find((p) => p.id === id)
    setClientId(proj?.client_id ?? '')
  }

  function resetQuickPay() {
    setShowQuickPay(false)
    setPayDate(todayStr())
    setPayAmount('0')
    setPayMode('UPI')
    setPayError(null)
    setPayDone(false)
  }

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault()
    if (!lastCreatedBill) return
    const amt = parseINR(payAmount)
    if (amt <= 0) {
      setPayError('Enter a payment amount.')
      return
    }
    setPaySubmitting(true)
    setPayError(null)
    try {
      await createVendorBillPayment.mutateAsync({
        bill_id: lastCreatedBill.id,
        date: payDate,
        amount: amt,
        payment_mode: payMode,
      })
      setPayDone(true)
    } catch (err) {
      setPayError(getErrorMessage(err, 'Could not save payment.'))
    } finally {
      setPaySubmitting(false)
    }
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
    if (!projectId) {
      setFormError('Pick a project.')
      return
    }
    if (!vendorId) {
      setFormError('Pick a vendor.')
      return
    }
    if (!date) {
      setFormError('Pick a bill date.')
      return
    }
    if (!description.trim()) {
      setFormError('Bill description is required.')
      return
    }
    if (isMenPower && (!qty || Number(qty) <= 0)) {
      setFormError('Enter a quantity.')
      return
    }
    if (isMenPower && parseINR(otherCost) > 0 && !remarks.trim()) {
      setFormError('Remarks are required when Other Cost has a value.')
      return
    }
    setSubmitting(true)
    try {
      const basePatch = {
        vendor_id: vendorId,
        description: description.trim(),
        remarks: remarks.trim() || null,
        client_id: clientId || null,
        project_id: projectId,
        date,
        amount: isMenPower ? (Number(qty) || 0) * parseINR(rate) : parseINR(amount),
        gst_pct: isMenPower ? 0 : Number(gstPct) || 0,
        qty: isMenPower ? Number(qty) || 0 : null,
        rate: isMenPower ? parseINR(rate) : null,
        other_cost: isMenPower ? parseINR(otherCost) || 0 : null,
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
        setLastCreatedBill(created)
        resetQuickPay()
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

      <form className="form-grid vb-form" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Project (active only, mandatory) — Client auto-derived, mandatory */}
        <div className="field-row">
          <div className="field">
            <label>Project</label>
            <SearchableSelect
              items={activeProjects}
              value={projectId}
              onChange={handleProjectChange}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— Select project —"
            />
          </div>
          <div className="field">
            <label>Client</label>
            <input type="text" value={projectId ? clientLabel(selectedProjectClient) : '—'} disabled />
          </div>
        </div>

        {/* Row 2: Vendor type */}
        <div className="field full">
          <label>Vendor type</label>
          <VendorCategoryPills categories={vendorCategories} category={vendorCategory} onChange={setVendorCategory} />
        </div>

        {/* Row 3: Vendor */}
        <div className="field full">
          <label>Vendor</label>
          <VendorCombobox vendors={filteredVendors} value={vendorId} onChange={setVendorId} allowCreate={canAddVendor} />
        </div>

        {/* Row 4: Date + Bill description (mandatory) */}
        <div className="field-row">
          <div className="field field-narrow">
            <label>Bill date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Bill description</label>
            <input
              type="text"
              required
              placeholder="e.g. plant stock, hardscape material"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Row 5: Bill value + GST% (or Qty/Rate for MenPower), plus receipt upload */}
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

        {/* Row 6: Remarks (or Other cost + Remarks for MenPower) */}
        {isMenPower ? (
          <div className="field-row">
            <div className="field">
              <label>Other cost (₹)</label>
              <CurrencyInput value={otherCost} onValueChange={setOtherCost} />
            </div>
            <div className="field">
              <label>Remarks{parseINR(otherCost) > 0 ? '' : ' (optional)'}</label>
              <input
                type="text"
                required={parseINR(otherCost) > 0}
                placeholder="Any extra context"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="field full">
            <label>Remarks (optional)</label>
            <input
              type="text"
              placeholder="Any extra context"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        )}

        {/* Row 7: Total + Add bill */}
        <div className="field-row vb-row5">
          <div className="field vb-total">
            <label>Total value (₹)</label>
            <input
              type="text"
              readOnly
              value={
                isMenPower
                  ? fmt(billTotal({ amount: (Number(qty) || 0) * parseINR(rate), gst_pct: 0, other_cost: parseINR(otherCost) }))
                  : fmt(billTotal({ amount: parseINR(amount), gst_pct: Number(gstPct) || 0 }))
              }
            />
          </div>
          <div className="field vb-submit">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editingBill ? 'Save changes' : 'Add bill'}
              </Button>
              {editingBill && (
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
              {lastCreatedBill && <IdBadge id={lastCreatedBill.display_id} />}
            </div>
          </div>
        </div>
      </form>

      {lastCreatedBill && !payDone && (
        <div style={{ marginTop: 12 }}>
          {!showQuickPay ? (
            <Button type="button" variant="secondary" onClick={() => setShowQuickPay(true)}>
              Add payment
            </Button>
          ) : (
            <form className="form-grid" onSubmit={handleAddPayment} style={{ marginTop: 4 }}>
              <div className="field-row">
                <div className="field field-narrow">
                  <label>Payment date</label>
                  <input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Amount (₹)</label>
                  <CurrencyInput value={payAmount} onValueChange={setPayAmount} required />
                </div>
              </div>
              <div className="field full">
                <label>Mode of payment</label>
                <div className="pill-tabs">
                  {PAYMENT_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={payMode === m ? 'pill active' : 'pill'}
                      onClick={() => setPayMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field full" style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" disabled={paySubmitting}>
                  {paySubmitting ? 'Saving…' : 'Add payment'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetQuickPay}>
                  Cancel
                </Button>
              </div>
              {payError && (
                <div className="note" style={{ color: 'var(--red)' }}>
                  {payError}
                </div>
              )}
            </form>
          )}
        </div>
      )}
      {payDone && (
        <div className="note" style={{ marginTop: 12, color: 'var(--accent)' }}>
          Payment recorded against {lastCreatedBill?.display_id}.
        </div>
      )}

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
