import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { InlineCalculator } from '../../components/InlineCalculator'
import { CostCenterPicker } from '../../components/CostCenterPicker'
import { SearchableSelect } from '../../components/SearchableSelect'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { useAuth } from '../../lib/auth'
import { useClients, useProjects, useVendors, useCostCenters, useExpenseCategories } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useCreateExpense, useUpdateExpense } from '../../lib/queries/expenses'
import { useLoans, useLoanPayments, useCreateLoanPayment } from '../../lib/queries/loans'
import { useCreateCapitalTx } from '../../lib/queries/capital'
import { useGeolocation } from '../../lib/useGeolocation'
import { compressImage } from '../../lib/compressImage'
import { uploadReceipt } from '../../lib/storage'
import { parseINR, fmt, fmtPlain } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel, matchesCategoryLabel } from '../../lib/labels'
import { loanOutstanding, monthlyInterestDue, totalInterestDue } from '../../lib/calc/loans'
import { VendorCombobox } from '../purchases/VendorCombobox'
import { useVendorCategoryFilter, VendorCategoryPills } from '../purchases/VendorCategoryFilter'
import type { Database } from '../../types/database'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']
type ToggleCategory = 'general' | 'purchase' | 'project' | 'loan' | 'capital'
type PaymentMode = 'UPI' | 'Cash' | 'Bank'

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank']

const TOGGLE_OPTIONS: { id: ToggleCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'project', label: 'Project' },
  { id: 'loan', label: 'Loan' },
  { id: 'capital', label: 'Capital' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
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
  const { profile } = useAuth()
  const canAddVendor = profile?.role === 'admin' || profile?.role === 'cxo'

  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: vendors } = useVendors()
  const { data: costCenters } = useCostCenters()
  const { data: profiles } = useProfiles()
  const { data: categories } = useExpenseCategories()
  const { data: loans } = useLoans(null)
  const { data: loanPayments } = useLoanPayments()
  // No visible GPS UI — still silently captured on mount and submitted with the transaction.
  const { geo } = useGeolocation()

  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const createLoanPayment = useCreateLoanPayment()
  const createCapitalTx = useCreateCapitalTx()

  const [toggleCategory, setToggleCategory] = useState<ToggleCategory>('general')
  const [amount, setAmount] = useState('0')
  const [showCalc, setShowCalc] = useState(false)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayStr())
  const [reimbursable, setReimbursable] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)

  // Row 2 fields — one set per category, only the relevant one is shown/used.
  const [costCenter, setCostCenter] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [loanId, setLoanId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [interestPaid, setInterestPaid] = useState('0')
  const [principalPaid, setPrincipalPaid] = useState('0')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI')

  const {
    categories: vendorCategories,
    category: vendorCategory,
    setCategory: setVendorCategory,
    filteredVendors,
  } = useVendorCategoryFilter(vendors, () => setVendorId(''))

  // Tags are scoped per category (same idea as sub-categories) — CoA seeds a
  // category per toggle option (General/Purchase/Project/Loan/Capital), so
  // the currently-selected toggle's tags come from the matching category.
  const selectedCategoryLabel = TOGGLE_OPTIONS.find((o) => o.id === toggleCategory)?.label ?? ''
  const selectedCategory = categories?.find((c) => matchesCategoryLabel(c.name, selectedCategoryLabel))
  const topTags = (selectedCategory?.tags ?? []).map((t) => `#${t}`)

  const visibleProjects = clientId ? projects?.filter((p) => p.client_id === clientId) : projects
  const activeProjects = projects?.filter((p) => p.status === 'active')
  const purchaseSelectedProject = projects?.find((p) => p.id === projectId)
  const purchaseProjectClient = purchaseSelectedProject
    ? clients?.find((c) => c.id === purchaseSelectedProject.client_id)
    : null
  const openLoans = loans?.filter((l) => {
    const payments = loanPayments?.filter((p) => p.loan_id === l.id) ?? []
    return loanOutstanding(l, payments) > 0
  })
  const selectedLoan = openLoans?.find((l) => l.id === loanId)
  const selectedLoanPayments = loanPayments?.filter((p) => p.loan_id === loanId) ?? []
  const suggestedMonthlyInterest = selectedLoan ? monthlyInterestDue(selectedLoan, selectedLoanPayments) : 0
  const suggestedInterestDue = selectedLoan ? totalInterestDue(selectedLoan, selectedLoanPayments) : 0

  const writesToExpenses = toggleCategory === 'general' || toggleCategory === 'purchase' || toggleCategory === 'project'
  // Project is no longer offered for new entries — project-related spend now
  // goes through Purchase (which already has its own Project selector).
  // Editing an existing Project-type expense still shows it, so old records
  // stay editable without being force-recategorized.
  const visibleToggleOptions = editingExpense
    ? TOGGLE_OPTIONS.filter((o) => o.id === 'general' || o.id === 'purchase' || o.id === 'project')
    : TOGGLE_OPTIONS.filter((o) => o.id !== 'project')

  useEffect(() => {
    if (!editingExpense) return
    const cat: ToggleCategory =
      editingExpense.type === 'General' ? 'general' : editingExpense.type === 'Purchase' ? 'purchase' : 'project'
    setToggleCategory(cat)
    setAmount(String(editingExpense.amount))
    setDescription(editingExpense.description)
    setDate(editingExpense.date)
    setReimbursable(editingExpense.reimbursable)
    setRemarks(editingExpense.remarks ?? '')
    setCostCenter(editingExpense.cost_center ?? '')
    setVendorId(editingExpense.vendor_id ?? '')
    setVendorCategory(null)
    setProjectId(editingExpense.project_id ?? '')
    const proj = projects?.find((p) => p.id === editingExpense.project_id)
    setClientId(proj?.client_id ?? '')
    setPaymentMode((editingExpense.payment_mode as PaymentMode) ?? 'UPI')
    setReceiptBlob(null)
    setReceiptStatus(editingExpense.receipt_path ? 'Photo attached' : 'Take photo')
    setShowCalc(false)
    setFormError(null)
    setLastCreatedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense, projects])

  function handleToggleChange(next: ToggleCategory) {
    setToggleCategory(next)
    setCostCenter('')
    setVendorId('')
    setVendorCategory(null)
    setClientId('')
    // projectId deliberately not reset here — the selected project should
    // stay put across category switches and repeated entries within the
    // same session, since users log many transactions against one project.
    setLoanId('')
    setPartnerId('')
    setInterestPaid('0')
    setPrincipalPaid('0')
  }

  function handleClientChange(id: string) {
    setClientId(id)
    const proj = projects?.find((p) => p.id === projectId)
    if (id && proj?.client_id !== id) setProjectId('')
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    const proj = projects?.find((p) => p.id === id)
    if (proj?.cost_center) setCostCenter(proj.cost_center)
  }

  function handleLoanChange(id: string) {
    setLoanId(id)
    const loan = openLoans?.find((l) => l.id === id)
    if (loan) {
      const payments = loanPayments?.filter((p) => p.loan_id === id) ?? []
      setInterestPaid(fmtPlain(totalInterestDue(loan, payments).toFixed(2)).replace(/,/g, ''))
    } else {
      setInterestPaid('0')
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

  function insertTag(tag: string) {
    setDescription((prev) => (prev.trim() + ' ' + tag).trim())
  }

  function resetForm() {
    setToggleCategory('general')
    setAmount('0')
    setDescription('')
    setCostCenter('')
    setVendorId('')
    setClientId('')
    // projectId deliberately not reset — see handleToggleChange.
    setLoanId('')
    setPartnerId('')
    setInterestPaid('0')
    setPrincipalPaid('0')
    setPaymentMode('UPI')
    setReimbursable(false)
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

    if (toggleCategory === 'project' && !projectId) {
      setFormError('Pick a project.')
      return
    }
    if (toggleCategory === 'loan' && !loanId) {
      setFormError('Pick a lender.')
      return
    }
    if (toggleCategory === 'capital' && !partnerId) {
      setFormError('Pick a partner.')
      return
    }
    if (writesToExpenses && !description.trim()) {
      setFormError('Tags are required.')
      return
    }

    setSubmitting(true)
    try {
      if (toggleCategory === 'loan') {
        const interest = parseINR(interestPaid)
        const principal = parseINR(principalPaid)
        if (interest <= 0 && principal <= 0) {
          setFormError('Enter an interest or principal amount.')
          setSubmitting(false)
          return
        }
        const created = await createLoanPayment.mutateAsync({
          loan_id: loanId,
          date,
          interest_paid: interest,
          principal_paid: principal,
          reference: description.trim() || null,
          payment_mode: paymentMode,
        })
        setLastCreatedId(created.display_id)
      } else if (toggleCategory === 'capital') {
        const amt = parseINR(amount)
        if (amt <= 0) {
          setFormError('Enter an amount.')
          setSubmitting(false)
          return
        }
        const created = await createCapitalTx.mutateAsync({
          partner_id: partnerId,
          type: 'withdrawal',
          amount: amt,
          date,
          notes: description.trim() || null,
          payment_mode: paymentMode,
        })
        setLastCreatedId(created.display_id)
      } else {
        const amt = parseINR(amount)
        if (amt <= 0) {
          setFormError('Enter an amount.')
          setSubmitting(false)
          return
        }
        let receiptPath: string | null = editingExpense?.receipt_path ?? null
        if (receiptBlob) {
          receiptPath = await uploadReceipt(receiptBlob)
        }
        const patch = {
          description: description.trim(),
          type: toggleCategory === 'general' ? 'General' : toggleCategory === 'purchase' ? 'Purchase' : 'Project',
          project_id: toggleCategory === 'project' || toggleCategory === 'purchase' ? projectId || null : null,
          cost_center: toggleCategory === 'general' || toggleCategory === 'project' ? costCenter || null : null,
          vendor_id: toggleCategory === 'purchase' ? vendorId || null : null,
          amount: amt,
          date,
          reimbursable,
          remarks: remarks.trim() || null,
          receipt_path: receiptPath,
          payment_mode: paymentMode,
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
      }

      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save.'))
    } finally {
      setSubmitting(false)
    }
  }

  const paymentModeField = (
    <div className="field full">
      <label>Payment mode</label>
      <div className="pill-tabs">
        {PAYMENT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={paymentMode === m ? 'pill active' : 'pill'}
            onClick={() => setPaymentMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <details className="toggle-section" open>
      <summary>Add transaction</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Category toggle */}
        <div className="field full">
          <label>Category</label>
          <div className="pill-tabs exp-cat-tabs">
            {visibleToggleOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={toggleCategory === opt.id ? 'pill active' : 'pill'}
                onClick={() => handleToggleChange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: category-specific field */}
        {toggleCategory === 'general' && (
          <div className="field full">
            <label>Cost center</label>
            <CostCenterPicker value={costCenter} onChange={setCostCenter} costCenters={costCenters} />
          </div>
        )}

        {toggleCategory === 'purchase' && (
          <div className="field-row">
            <div className="field">
              <label>Project</label>
              <SearchableSelect
                items={activeProjects}
                value={projectId}
                onChange={setProjectId}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder="— Select project (optional) —"
              />
            </div>
            <div className="field">
              <label>Client</label>
              <input type="text" value={projectId ? clientLabel(purchaseProjectClient) : '—'} disabled />
            </div>
          </div>
        )}

        {toggleCategory === 'purchase' && (
          <div className="field full">
            <label>Vendor type</label>
            <VendorCategoryPills categories={vendorCategories} category={vendorCategory} onChange={setVendorCategory} />
          </div>
        )}

        {toggleCategory === 'project' && (
          <div className="field-row">
            <div className="field">
              <label>Client (optional)</label>
              <SearchableSelect
                items={clients}
                value={clientId}
                onChange={handleClientChange}
                getId={(c) => c.id}
                getLabel={(c) => clientLabel(c)}
                placeholder="— Any client —"
              />
            </div>
            <div className="field">
              <label>Project</label>
              <SearchableSelect
                items={visibleProjects}
                value={projectId}
                onChange={handleProjectChange}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder="— Select project —"
              />
            </div>
          </div>
        )}

        {toggleCategory === 'loan' && (
          <div className="field full">
            <label>Lender</label>
            <SearchableSelect
              items={openLoans}
              value={loanId}
              onChange={handleLoanChange}
              getId={(l) => l.id}
              getLabel={(l) => `${l.lender} (${l.display_id ?? ''})`}
              placeholder="— Select lender —"
            />
            {selectedLoan && (
              <div className="note" style={{ marginTop: 2 }}>
                Monthly interest: {fmt(suggestedMonthlyInterest)} · Interest due ({selectedLoan.interest_due_months} mo): {fmt(suggestedInterestDue)}
              </div>
            )}
          </div>
        )}

        {toggleCategory === 'capital' && (
          <div className="field full">
            <label>Partner</label>
            <SearchableSelect
              items={profiles}
              value={partnerId}
              onChange={setPartnerId}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— Select partner —"
            />
          </div>
        )}

        {/* Row 3: Tags (alongside Vendor, for Purchase) */}
        {toggleCategory === 'purchase' ? (
          <div className="field-row">
            <div className="field">
              <label>Vendor</label>
              <VendorCombobox vendors={filteredVendors} value={vendorId} onChange={setVendorId} allowCreate={canAddVendor} />
            </div>
            <div className="field">
              <label>Tags</label>
              <input
                type="text"
                required={writesToExpenses}
                placeholder="Use #tags to make it searchable"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="field full">
            <label>Tags</label>
            <input
              type="text"
              required={writesToExpenses}
              placeholder="Use #tags to make it searchable"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

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

        {/* Row 4: Date + Amount (or Date + Interest + Principal for Loan) */}
        {toggleCategory === 'loan' ? (
          <div className="field-row exp-loan-row4">
            <div className="field field-narrow">
              <label>Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Interest (₹)</label>
              <CurrencyInput value={interestPaid} onValueChange={setInterestPaid} />
            </div>
            <div className="field">
              <label>Principal (₹)</label>
              <CurrencyInput value={principalPaid} onValueChange={setPrincipalPaid} />
            </div>
          </div>
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
        {showCalc && (
          <InlineCalculator
            onResult={(value) => {
              setAmount(String(value))
              setShowCalc(false)
            }}
          />
        )}

        {/* Row 5: Remarks (optional, extra context beyond the required Tags) */}
        {writesToExpenses && (
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

        {writesToExpenses && (
          <>
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
                  {PAYMENT_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={paymentMode === m ? 'pill active' : 'pill'}
                      onClick={() => setPaymentMode(m)}
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
              <div className="field row-inline" style={{ flex: '0 0 auto' }}>
                <input
                  type="checkbox"
                  id="e-reimb"
                  checked={reimbursable}
                  onChange={(e) => setReimbursable(e.target.checked)}
                />
                <label htmlFor="e-reimb">Reimbursable</label>
              </div>
            </div>
            <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          </>
        )}

        {!writesToExpenses && (
          <>
            {paymentModeField}
            <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add transaction'}
              </Button>
              {lastCreatedId && <IdBadge id={lastCreatedId} />}
            </div>
          </>
        )}
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
