import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { InlineCalculator } from '../../components/InlineCalculator'
import { SearchableSelect } from '../../components/SearchableSelect'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { useClients, useProjects, useCostCenters, useExpensePurposes, useExpenseUnits } from '../../lib/queries/masters'
import { useCreateExpense, useUpdateExpense } from '../../lib/queries/expenses'
import { useCreateExpenseUnit } from '../../lib/queries/admin'
import { useGeolocation } from '../../lib/useGeolocation'
import { compressImage } from '../../lib/compressImage'
import { uploadReceipt } from '../../lib/storage'
import { fmt, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel } from '../../lib/labels'
import type { Database } from '../../types/database'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']
type Settlement = 'UPI' | 'Cash' | 'Bank' | 'Reimbursable'

const SETTLEMENT_OPTIONS: Settlement[] = ['UPI', 'Cash', 'Bank', 'Reimbursable']
const PROJECT_STORAGE_KEY = 'lis.expenses.lastProject'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Project selection sticks for the rest of the day (per-user request), then
// resets — so tomorrow's first entry doesn't default to yesterday's project.
function loadStoredProject(): string {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return ''
    const { projectId, date } = JSON.parse(raw) as { projectId: string; date: string }
    return date === todayStr() ? projectId : ''
  } catch {
    return ''
  }
}

function storeProject(projectId: string) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ projectId, date: todayStr() }))
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

function CalculatorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="16" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" />
      <line x1="12" y1="15" x2="12" y2="15" />
      <line x1="16" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="8" y2="19" />
      <line x1="12" y1="19" x2="12" y2="19" />
      <line x1="16" y1="19" x2="16" y2="19" />
    </svg>
  )
}

export function ExpenseForm({
  editingExpense,
  onDoneEditing,
}: {
  editingExpense: ExpenseRow | null
  onDoneEditing: () => void
}) {
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: costCenters } = useCostCenters()
  const { data: purposes } = useExpensePurposes()
  const { data: units } = useExpenseUnits()
  // No visible GPS UI — still silently captured on mount and submitted with the transaction.
  const { geo } = useGeolocation()

  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const createUnit = useCreateExpenseUnit()

  const [costCenterOverride, setCostCenterOverride] = useState<string | null>(null)
  const [projectId, setProjectId] = useState(() => loadStoredProject())
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('0')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('Nos')
  const [rate, setRate] = useState('0')
  const [additionalAmount, setAdditionalAmount] = useState('0')
  const [showCalc, setShowCalc] = useState(false)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayStr())
  const [remarks, setRemarks] = useState('')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [settlement, setSettlement] = useState<Settlement>('UPI')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)

  const activeProjects = projects?.filter((p) => p.status === 'active')
  const defaultCostCenter = projectId ? 'Projects' : (costCenters?.[0]?.name ?? '')
  const costCenter = costCenterOverride ?? defaultCostCenter
  const isProjectCostCenter = costCenter === 'Projects'
  const selectedProject = projects?.find((p) => p.id === projectId)
  const selectedProjectClient = selectedProject ? clients?.find((c) => c.id === selectedProject.client_id) : null
  const projectTotal = (Number(qty) || 0) * parseINR(rate) + parseINR(additionalAmount)

  // Tags are scoped per cost center (managed in Admin → Cost centers) — except
  // under Projects, where Purpose (managed in Admin → Purposes) is the finer
  // breakdown and supplies the quick-tag list instead.
  const selectedCostCenter = costCenters?.find((cc) => cc.name === costCenter)
  const selectedPurpose = purposes?.find((p) => p.name === purpose)
  const tagSource = isProjectCostCenter ? selectedPurpose?.tags : selectedCostCenter?.tags
  const topTags = (tagSource ?? []).map((t) => `#${t}`)

  useEffect(() => {
    if (!editingExpense) return
    setCostCenterOverride(editingExpense.cost_center ?? null)
    setProjectId(editingExpense.project_id ?? '')
    setPurpose(editingExpense.purpose ?? '')
    setAmount(String(editingExpense.amount))
    setQty(editingExpense.qty != null ? String(editingExpense.qty) : '')
    setUnit(editingExpense.unit ?? 'Nos')
    setRate(editingExpense.rate != null ? String(editingExpense.rate) : '0')
    setAdditionalAmount(editingExpense.additional_amount != null ? String(editingExpense.additional_amount) : '0')
    setDescription(editingExpense.description)
    setDate(editingExpense.date)
    setRemarks(editingExpense.remarks ?? '')
    setSettlement(editingExpense.reimbursable ? 'Reimbursable' : (editingExpense.payment_mode as Settlement) ?? 'UPI')
    setReceiptBlob(null)
    setReceiptStatus(editingExpense.receipt_path ? 'Photo attached' : 'Take photo')
    setShowCalc(false)
    setFormError(null)
    setLastCreatedId(null)
  }, [editingExpense])

  function handleCostCenterChange(name: string) {
    setCostCenterOverride(name)
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    storeProject(id)
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

  function insertTag(tag: string) {
    setDescription((prev) => (prev.trim() + ' ' + tag).trim())
  }

  function resetForm() {
    setCostCenterOverride(null)
    setPurpose('')
    setAmount('0')
    setQty('')
    setUnit('Nos')
    setRate('0')
    setAdditionalAmount('0')
    setDescription('')
    // projectId deliberately not reset — it stays the default for the rest
    // of the day (see loadStoredProject), across repeated entries.
    setSettlement('UPI')
    setRemarks('')
    setReceiptBlob(null)
    setReceiptStatus('Take photo')
    setDate(todayStr())
    setShowCalc(false)
  }

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (isProjectCostCenter && !projectId) {
      setFormError('Pick a project.')
      return
    }
    if (isProjectCostCenter && (!qty || Number(qty) <= 0)) {
      setFormError('Enter a quantity.')
      return
    }
    if (!description.trim()) {
      setFormError('Tags are required.')
      return
    }
    const amt = isProjectCostCenter ? projectTotal : parseINR(amount)
    if (amt <= 0) {
      setFormError('Enter an amount.')
      return
    }

    setSubmitting(true)
    try {
      let receiptPath: string | null = editingExpense?.receipt_path ?? null
      if (receiptBlob) {
        receiptPath = await uploadReceipt(receiptBlob)
      }
      if (isProjectCostCenter && unit.trim() && !units?.some((u) => u.name === unit.trim())) {
        createUnit.mutate(unit.trim())
      }
      const patch = {
        description: description.trim(),
        project_id: isProjectCostCenter ? projectId || null : null,
        cost_center: costCenter || null,
        purpose: isProjectCostCenter ? purpose || null : null,
        amount: amt,
        qty: isProjectCostCenter ? Number(qty) || null : null,
        unit: isProjectCostCenter ? unit.trim() || null : null,
        rate: isProjectCostCenter ? parseINR(rate) || null : null,
        additional_amount: isProjectCostCenter ? parseINR(additionalAmount) || 0 : null,
        date,
        reimbursable: settlement === 'Reimbursable',
        remarks: remarks.trim() || null,
        receipt_path: receiptPath,
        payment_mode: settlement === 'Reimbursable' ? null : settlement,
      }
      if (editingExpense) {
        await updateExpense.mutateAsync({
          id: editingExpense.id,
          patch: { ...patch, geo_lat: editingExpense.geo_lat, geo_lng: editingExpense.geo_lng },
        })
        onDoneEditing()
      } else {
        const created = await createExpense.mutateAsync({ ...patch, geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null })
        setLastCreatedId(created.display_id)
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section" open>
      <summary>{editingExpense ? 'Edit transaction' : 'Add transaction'}</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Cost center */}
        <div className="field full">
          <label>Cost center</label>
          <div className="pill-tabs">
            {(costCenters ?? []).map((cc) => (
              <button
                key={cc.id}
                type="button"
                className={costCenter === cc.name ? 'pill active' : 'pill'}
                onClick={() => handleCostCenterChange(cc.name)}
              >
                {cc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Project + Client, only when "Projects" is the cost center */}
        {isProjectCostCenter && (
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
        )}

        {/* Row 2b: Purpose — Projects only, its tags feed future KPIs */}
        {isProjectCostCenter && (
          <div className="field full">
            <label>Purpose</label>
            <div className="pill-tabs">
              {(purposes ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={purpose === p.name ? 'pill active' : 'pill'}
                  onClick={() => setPurpose(purpose === p.name ? '' : p.name)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Tags */}
        <div className="field full">
          <label>Tags</label>
          <input
            type="text"
            required
            placeholder="Use #tags to make it searchable"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {topTags.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            {topTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertTag(t)}
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '2px 9px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  margin: '2px 3px 2px 0',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Row 4: Date + Amount — or, under Projects, Qty x Unit x Rate then
            Additional amount + Date, with the total shown by the submit button. */}
        {isProjectCostCenter ? (
          <>
            <div className="field-row">
              <div className="field">
                <label>Qty</label>
                <input type="number" min="0" step="0.01" required value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="field">
                <label>Unit</label>
                <input type="text" list="expense-units" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <datalist id="expense-units">
                  {(units ?? []).map((u) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Rate (₹)</label>
                <CurrencyInput value={rate} onValueChange={setRate} />
              </div>
            </div>
            <div className="field-row exp-row4">
              <div className="field">
                <label>Additional amount (₹)</label>
                <CurrencyInput value={additionalAmount} onValueChange={setAdditionalAmount} />
              </div>
              <div className="field field-narrow">
                <label>Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </>
        ) : (
          <div className="field-row exp-row4">
            <div className="field field-narrow">
              <label>Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <div className="amount-row" style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <CurrencyInput
                  value={amount}
                  onValueChange={setAmount}
                  required
                  className="amount-input"
                  style={{
                    minWidth: 0,
                    height: 44,
                    boxSizing: 'border-box',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 21,
                    fontWeight: 500,
                    padding: '0 10px',
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="calc-btn"
                  style={{
                    height: 44,
                    padding: 0,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Open calculator"
                  onClick={() => setShowCalc((v) => !v)}
                >
                  <CalculatorIcon />
                </Button>
              </div>
            </div>
          </div>
        )}
        {showCalc && !isProjectCostCenter && (
          <InlineCalculator
            onResult={(value) => {
              setAmount(String(value))
              setShowCalc(false)
            }}
          />
        )}

        {/* Row 5: Remarks (optional) */}
        <div className="field full">
          <label>Remarks (optional)</label>
          <input
            type="text"
            placeholder="Any extra context"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <hr className="form-divider" />
        {receiptStatus === 'Could not process photo' && (
          <div className="field full">
            <div className="note" style={{ color: 'var(--red)', marginTop: -6 }}>
              Could not process that photo — try again.
            </div>
          </div>
        )}
        <div className="field-row exp-footer-row" style={{ alignItems: 'center' }}>
          <div className="field" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <label>Payment mode</label>
            <div className="pill-tabs">
              {SETTLEMENT_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={settlement === m ? 'pill active' : 'pill'}
                  onClick={() => setSettlement(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <ReceiptUploadButton
              idPrefix="e-receipt"
              hasFile={!!receiptBlob}
              status={receiptStatus}
              onFile={handleReceiptFile}
            />
          </div>
        </div>
        <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isProjectCostCenter && (
            <div className="note" style={{ margin: 0, fontWeight: 600 }}>
              Total: {fmt(projectTotal)}
            </div>
          )}
          <Button type="submit" disabled={submitting} style={{ flex: editingExpense ? undefined : '1 1 auto' }}>
            {submitting ? 'Saving…' : editingExpense ? 'Save changes' : 'Add expense'}
          </Button>
          {editingExpense && (
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {lastCreatedId && <IdBadge id={lastCreatedId} />}
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
