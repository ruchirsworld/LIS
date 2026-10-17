import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { SearchableSelect } from '../../components/SearchableSelect'
import {
  PaymentAccountPicker,
  bankAccountIdOf,
  paymentModeOf,
  REIMBURSE_ACCOUNT as REIMBURSE,
} from '../../components/PaymentAccountPicker'
import { useAuth } from '../../lib/auth'
import { useClients, useProjects, useVendors, useExpenseSubHeads } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useCreateVendorBill, useUpdateVendorBill, useCreateVendorBillPayment, useSaveVendorBillItems, useVendorBillItems } from '../../lib/queries/purchases'
import { emptyItem, itemToDraft, itemsProblem, itemsToSave, itemsTotal, usableItems, type BillItemDraft } from '../../lib/calc/billItems'
import { BillItemsEditor } from './BillItemsEditor'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { billTotal, billTdsAmt } from '../../lib/calc/vendorBills'
import { compressImage } from '../../lib/compressImage'
import { uploadReceiptToDrive } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel } from '../../lib/labels'
import { VendorCombobox } from './VendorCombobox'
import { AddVendorModal } from './AddVendorModal'
import { TDS_SECTIONS } from './tdsSections'
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
  inModal = false,
}: {
  editingBill: VendorBill | null
  onDoneEditing: () => void
  /** Shown inside a popup: without the section heading around it. */
  inModal?: boolean
}) {
  const { profile } = useAuth()
  const canAddVendor = profile?.role === 'admin' || profile?.role === 'cxo'
  const { data: vendors } = useVendors()
  const { data: profiles } = useProfiles()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const createVendorBill = useCreateVendorBill()
  const updateVendorBill = useUpdateVendorBill()
  const createVendorBillPayment = useCreateVendorBillPayment()
  const saveBillItems = useSaveVendorBillItems()
  const { data: allItems } = useVendorBillItems()

  const [vendorId, setVendorId] = useState('')
  const [showAddVendor, setShowAddVendor] = useState(false)
  const { categories: vendorCategories, category: vendorCategory, setCategory: setVendorCategory, filteredVendors } =
    useVendorCategoryFilter(vendors, () => setVendorId(''), vendorId)
  const [subHeadId, setSubHeadId] = useState('')
  const [description, setDescription] = useState('')
  const [remarks, setRemarks] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('0')
  const [gstPct, setGstPct] = useState('0')
  const [otherCost, setOtherCost] = useState('0')
  const [tdsKey, setTdsKey] = useState('')
  const [tdsPct, setTdsPct] = useState('0')
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('')
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState('')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  // What was bought on this bill. With items, the bill value is their total.
  const [items, setItems] = useState<BillItemDraft[]>([])
  const itemsLoadedFor = useRef<string | null>(null)
  const itemsOn = usableItems(items).length > 0
  const itemsSum = itemsTotal(items)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [lastCreatedBill, setLastCreatedBill] = useState<VendorBill | null>(null)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const [payDate, setPayDate] = useState(todayStr())
  const [payAmount, setPayAmount] = useState('0')
  const [payAccountId, setPayAccountId] = useState('')
  const [payPaidBy, setPayPaidBy] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [payDone, setPayDone] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)

  const activeProjects = projects?.filter((p) => p.status === 'active')
  const selectedProject = projects?.find((p) => p.id === projectId)
  const selectedProjectClient = selectedProject ? clients?.find((c) => c.id === selectedProject.client_id) : null
  const selectedVendor = vendors?.find((v) => v.id === vendorId)
  const isSupervisor = selectedVendor?.category === 'Supervisor'

  // Procurement always posts to Materials & Consumables — there's nothing to
  // pick, so Major head isn't a form field here — just these sub-heads, in
  // this order (plant stock gets its own sub-head, split out from the
  // general Project Materials catch-all — see the bill-description
  // placeholder below).
  const PROCUREMENT_SUB_HEAD_CODES = ['20.1', '20.7', '20.6', '20.4']
  const subHeadOptions = PROCUREMENT_SUB_HEAD_CODES.map((code) => (subHeads ?? []).find((s) => s.code === code)).filter(
    (s): s is NonNullable<typeof s> => !!s
  )
  const defaultSubHead = subHeadOptions.find((s) => s.code === '20.1') ?? null

  // Apply the Project Materials default once, the first time sub-heads load
  // for a fresh (non-editing) form — never again after that, so a
  // Supervisor freely browsing other sub-heads doesn't get snapped back.
  const defaultApplied = useRef(false)
  // Once the user picks a sub-head themselves, choosing a vendor no longer
  // changes it for them.
  const subHeadTouched = useRef(false)
  useEffect(() => {
    if (editingBill || defaultApplied.current || !defaultSubHead) return
    defaultApplied.current = true
    setSubHeadId(defaultSubHead.id)
  }, [defaultSubHead, editingBill])

  // A contractor's bill is Sub-Contract, not the Project Materials default —
  // suggest it as soon as such a vendor is picked, unless a sub-head was
  // already chosen by hand or an existing bill is being edited.
  function handleVendorChange(id: string, category?: string | null) {
    setVendorId(id)
    if (editingBill || subHeadTouched.current) return
    const vendorCategory = category !== undefined ? category : vendors?.find((v) => v.id === id)?.category
    const suggested = subHeadOptions.find((s) => s.code === (vendorCategory === 'Contractor' ? '20.6' : '20.1'))
    if (suggested) setSubHeadId(suggested.id)
  }

  // The bill value follows the items.
  useEffect(() => {
    if (itemsOn) setAmount(String(itemsSum))
  }, [itemsOn, itemsSum])

  // Bring in the items of the bill being edited, once they have loaded.
  useEffect(() => {
    if (!editingBill) {
      itemsLoadedFor.current = null
      return
    }
    if (!allItems || itemsLoadedFor.current === editingBill.id) return
    itemsLoadedFor.current = editingBill.id
    setItems(allItems.filter((i) => i.bill_id === editingBill.id).map(itemToDraft))
  }, [editingBill, allItems])

  useEffect(() => {
    if (!editingBill) return
    setVendorId(editingBill.vendor_id)
    setSubHeadId(editingBill.sub_head_id ?? '')
    setDescription(editingBill.description ?? '')
    setRemarks(editingBill.remarks ?? '')
    setClientId(editingBill.client_id ?? '')
    setProjectId(editingBill.project_id ?? '')
    setDate(editingBill.date ?? todayStr())
    setAmount(String(editingBill.amount))
    setGstPct(String(editingBill.gst_pct ?? 0))
    setOtherCost(editingBill.other_cost != null ? String(editingBill.other_cost) : '0')
    setTdsPct(String(editingBill.tds_pct ?? 0))
    setTdsKey(
      TDS_SECTIONS.find((t) => t.section === editingBill.tds_section && t.pct === Number(editingBill.tds_pct ?? 0))?.value ??
        (editingBill.tds_section ? 'other' : '')
    )
    setVendorInvoiceNo(editingBill.vendor_invoice_no ?? '')
    setVendorInvoiceDate(editingBill.vendor_invoice_date ?? '')
    setReceiptBlob(null)
    setReceiptStatus(editingBill.receipt_path ? 'Photo attached' : 'Take photo')
    setFormError(null)
    setLastCreatedBill(null)
  }, [editingBill])

  function resetForm() {
    subHeadTouched.current = false
    setVendorId('')
    setVendorCategory(null)
    setSubHeadId(defaultSubHead?.id ?? '')
    setDescription('')
    setRemarks('')
    setClientId('')
    setProjectId('')
    setDate(todayStr())
    setAmount('0')
    setGstPct('0')
    setOtherCost('0')
    setTdsKey('')
    setTdsPct('0')
    setVendorInvoiceNo('')
    setVendorInvoiceDate('')
    setReceiptBlob(null)
    setReceiptStatus('Take photo')
    setItems([])
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
    setPayAccountId('')
    setPayPaidBy('')
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
    if (payAccountId === REIMBURSE && !payPaidBy) {
      setPayError('Pick who paid, so they can be reimbursed.')
      return
    }
    setPaySubmitting(true)
    setPayError(null)
    try {
      await createVendorBillPayment.mutateAsync({
        bill_id: lastCreatedBill.id,
        date: payDate,
        amount: amt,
        payment_mode: paymentModeOf(payAccountId),
        bank_account_id: bankAccountIdOf(payAccountId),
        paid_by: payAccountId === REIMBURSE ? payPaidBy : null,
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
    if (!subHeadId) {
      setFormError('Pick a sub-head.')
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
    if (!isSupervisor && parseINR(otherCost) > 0 && !remarks.trim()) {
      setFormError('Remarks are required when Other Cost has a value.')
      return
    }
    const itemsError = itemsProblem(items)
    if (itemsError) {
      setFormError(itemsError)
      return
    }
    setSubmitting(true)
    try {
      const basePatch = {
        vendor_id: vendorId,
        sub_head_id: subHeadId,
        description: description.trim(),
        remarks: remarks.trim() || null,
        client_id: clientId || null,
        project_id: projectId,
        date,
        amount: itemsOn ? itemsSum : parseINR(amount),
        gst_pct: isSupervisor ? 0 : Number(gstPct) || 0,
        qty: null,
        rate: null,
        other_cost: isSupervisor ? 0 : parseINR(otherCost) || 0,
        tds_pct: isSupervisor ? 0 : Number(tdsPct) || 0,
        tds_section: isSupervisor || !tdsKey ? null : TDS_SECTIONS.find((t) => t.value === tdsKey)?.section ?? null,
        vendor_invoice_no: vendorInvoiceNo.trim() || null,
        vendor_invoice_date: vendorInvoiceDate || null,
      }

      // The bill is saved first; its items follow. A bill that had items and now has none is cleared too.
      let savedBillId = editingBill?.id ?? ''
      const hadItems = editingBill ? (allItems ?? []).some((i) => i.bill_id === editingBill.id) : false
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
        savedBillId = created.id
        if (receiptBlob) {
          const receiptPath = await uploadReceiptToDrive(receiptBlob, receiptFileName(created.display_id, date))
          await updateVendorBill.mutateAsync({ id: created.id, patch: { receipt_path: receiptPath } })
        }
        setLastCreatedBill(created)
        resetQuickPay()
      }
      if (itemsOn || hadItems) {
        try {
          await saveBillItems.mutateAsync({ billId: savedBillId, items: itemsToSave(items) })
        } catch (err) {
          setFormError(`The bill was saved, but its items could not be saved: ${getErrorMessage(err, 'unknown error')}`)
        }
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save bill.'))
    } finally {
      setSubmitting(false)
    }
  }

  const body = (
    <>
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
          <VendorCombobox vendors={filteredVendors} value={vendorId} onChange={(id) => handleVendorChange(id)} />
          {canAddVendor && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, fontWeight: 400 }}>
              <input type="checkbox" checked={showAddVendor} onChange={(e) => setShowAddVendor(e.target.checked)} />
              Vendor isn't in the list — add a new one
            </label>
          )}
        </div>
        {/* Row 3b: Sub-head — what this bill is actually for. Major head is
            always Materials & Consumables for Procurement, so it isn't a
            field here. */}
        <div className="field full">
          <label>Sub-head</label>
          <SearchableSelect
            items={subHeadOptions}
            value={subHeadId}
            onChange={(id) => {
              subHeadTouched.current = true
              setSubHeadId(id)
            }}
            getId={(s) => s.id}
            getLabel={(s) => s.name}
            placeholder="— Select sub-head —"
          />
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

        {/* What was bought: optional lines; with any, the bill value is their total */}
        <div className="field full">
          {items.length === 0 ? (
            <button type="button" className="btn link" style={{ padding: 0 }} onClick={() => setItems([emptyItem()])}>
              + Add the items bought on this bill
            </button>
          ) : (
            <>
              <label>Items on this bill</label>
              <BillItemsEditor items={items} onChange={setItems} idPrefix="vb" />
              <button type="button" className="btn link" style={{ padding: 0 }} onClick={() => setItems([])}>
                Remove all items and type the bill value instead
              </button>
            </>
          )}
        </div>

        {/* Row 5: Amount only for Supervisor, or Bill value + GST% otherwise, plus receipt upload */}
        <div className="field-row">
          {isSupervisor ? (
            <div className="field">
              <label>Amount (₹){itemsOn ? ' — total of the items' : ''}</label>
              <CurrencyInput value={amount} onValueChange={setAmount} required readOnly={itemsOn} />
            </div>
          ) : (
            <>
              <div className="field">
                <label>Bill value (₹){itemsOn ? ' — total of the items' : ''}</label>
                <CurrencyInput value={amount} onValueChange={setAmount} required readOnly={itemsOn} />
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

        {/* Row 5b: the supplier's own invoice (needed to claim input GST) and TDS deducted */}
        {!isSupervisor && (
          <>
            <div className="field-row">
              <div className="field">
                <label>Supplier's invoice no.</label>
                <input type="text" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} />
              </div>
              <div className="field field-narrow">
                <label>Supplier's invoice date</label>
                <input type="date" value={vendorInvoiceDate} onChange={(e) => setVendorInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>TDS deducted</label>
                <select
                  value={tdsKey}
                  onChange={(e) => {
                    const t = TDS_SECTIONS.find((x) => x.value === e.target.value)
                    setTdsKey(e.target.value)
                    if (t && t.value !== 'other') setTdsPct(String(t.pct))
                  }}
                >
                  {TDS_SECTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field-narrow">
                <label>TDS %</label>
                <input type="number" min="0" max="100" step="0.01" value={tdsPct} onChange={(e) => setTdsPct(e.target.value)} />
              </div>
            </div>
            {selectedVendor && Number(gstPct) > 0 && !selectedVendor.gstin && (
              <div className="note" style={{ color: 'var(--red)' }}>
                This vendor has no GSTIN on file, so the GST on this bill cannot be claimed as input credit. Add the GSTIN under Settings, Vendors.
              </div>
            )}
            {selectedVendor && Number(tdsPct) > 0 && !selectedVendor.pan && (
              <div className="note" style={{ color: 'var(--red)' }}>
                This vendor has no PAN on file. TDS without a PAN is deducted at a higher rate (Section 206AA).
              </div>
            )}
          </>
        )}

        {/* Row 6: Other cost + Remarks (Remarks becomes mandatory once Other cost has a value) — Other cost doesn't apply to Supervisor */}
        <div className="field-row">
          {!isSupervisor && (
            <div className="field">
              <label>Other cost (₹)</label>
              <CurrencyInput value={otherCost} onValueChange={setOtherCost} />
            </div>
          )}
          <div className="field">
            <label>Remarks{!isSupervisor && parseINR(otherCost) > 0 ? '' : ' (optional)'}</label>
            <input
              type="text"
              required={!isSupervisor && parseINR(otherCost) > 0}
              placeholder="Any extra context"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Row 7: Total + Add bill */}
        <div className="field-row vb-row5">
          {!isSupervisor && Number(tdsPct) > 0 && (
            <div className="field vb-total">
              <label>TDS to deduct (₹)</label>
              <input
                type="text"
                readOnly
                value={fmt(billTdsAmt({ amount: parseINR(amount), gst_pct: 0, other_cost: parseINR(otherCost), tds_pct: Number(tdsPct) || 0 }))}
              />
            </div>
          )}
          <div className="field vb-total">
            <label>Total value (₹)</label>
            <input
              type="text"
              readOnly
              value={fmt(
                billTotal({
                  amount: parseINR(amount),
                  gst_pct: isSupervisor ? 0 : Number(gstPct) || 0,
                  other_cost: isSupervisor ? 0 : parseINR(otherCost),
                })
              )}
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
      {/* Rendered outside the bill form on purpose: the modal has its own
          <form>, and a form nested inside another makes the browser submit
          the page (a full reload) instead of just adding the vendor. */}
      {showAddVendor && (
        <AddVendorModal
          onClose={() => setShowAddVendor(false)}
          onCreated={(v) => {
            // Reset the type filter first — otherwise a category that
            // doesn't match the newly created vendor would hide it right
            // after picking it.
            setVendorCategory(null)
            handleVendorChange(v.id, v.category)
            setShowAddVendor(false)
          }}
        />
      )}

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
              <PaymentAccountPicker className="full" value={payAccountId} onChange={setPayAccountId} allowReimbursement />

              {payAccountId === REIMBURSE && (
                <div className="field full">
                  <label>Paid by (to be reimbursed)</label>
                  <SearchableSelect
                    items={profiles}
                    value={payPaidBy}
                    onChange={setPayPaidBy}
                    getId={(p) => p.id}
                    getLabel={(p) => p.name}
                    placeholder="— Select person —"
                  />
                </div>
              )}
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
    </>
  )

  return inModal ? (
    <div>{body}</div>
  ) : (
    <details className="toggle-section" open>
      <summary>Vendor bills</summary>
      {body}
    </details>
  )
}
