import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { InlineCalculator } from '../../components/InlineCalculator'
import { SearchableSelect } from '../../components/SearchableSelect'
import { ReceiptUploadButton } from '../../components/ReceiptUploadButton'
import { Modal } from '../../components/Modal'
import { useClients, useProjects, useCostCenters, useExpenseSubHeads, useExpenseUnits, useBankAccounts } from '../../lib/queries/masters'
import { useCreateExpense, useUpdateExpense } from '../../lib/queries/expenses'
import { useCreateExpenseUnit } from '../../lib/queries/admin'
import { useGeolocation } from '../../lib/useGeolocation'
import { compressImage } from '../../lib/compressImage'
import { uploadReceipt } from '../../lib/storage'
import { fmt, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel } from '../../lib/labels'
import { TRIP_QUICK_CATEGORIES } from '../../lib/tripQuickCategories'
import { ADMIN_QUICK_CATEGORIES } from '../../lib/adminQuickCategories'
import type { QuickCategory } from '../../lib/quickCategories'
import type { Database } from '../../types/database'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']

const PROJECT_STORAGE_KEY = 'lis.expenses.lastProject'
const GST_RATES = [0, 5, 12, 18, 28]
const CASH = 'cash'
// Not a real account — picking this means the employee paid out of pocket
// and the firm owes it back, so no cash/bank actually moves yet.
const REIMBURSE = 'reimburse'
// Also not a real account — set automatically when a Supervisor's own
// Project claim is approved (see handleApproveSupervisor in
// PendingClaimApprovals.tsx), never picked here. Shown read-only so
// editing one of these doesn't misrepresent it as Cash and doesn't silently
// clear paid_from_imprest on save.
const IMPREST = 'imprest'

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
  tripId,
  tripDate,
  fixedCostCenter,
  fixedProjectId,
  lockToProjects,
}: {
  editingExpense: ExpenseRow | null
  onDoneEditing: () => void
  /** When set (embedding this form inside a Trip sheet), every entry created
   * here is tagged to that trip — same expense, same ledger posting, just
   * with the extra trip dimension. */
  tripId?: string
  /** The date to log a trip entry under — picked from the date field next to
   * End Trip in the Trips header, not from a field in this form. */
  tripDate?: string
  /** Cost center and project the trip was started with — entries logged
   * under a trip inherit both instead of picking their own each time. */
  fixedCostCenter?: string | null
  fixedProjectId?: string | null
  /** Used by the Project section — locks the cost center to "Project" (no
   * picker, since it's the only option there) while still letting the user
   * pick *which* project per entry, unlike a trip's fixed one. */
  lockToProjects?: boolean
}) {
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: costCenters } = useCostCenters()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: units } = useExpenseUnits()
  const { data: bankAccounts } = useBankAccounts()
  // Bank accounts first (Kotak, then CBI, then anything else alphabetically),
  // Cash and Reimbursement always last — matches the requested button order.
  const BANK_ORDER = ['Kotak', 'CBI']
  const sortedBankAccounts = [...(bankAccounts ?? [])].sort((a, b) => {
    const ai = BANK_ORDER.indexOf(a.name)
    const bi = BANK_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  // Imprest is only ever shown, never offered, and only when the record
  // being edited already has it — see the IMPREST constant above.
  const accountOptions = [
    ...sortedBankAccounts,
    { id: CASH, name: 'Cash' },
    { id: REIMBURSE, name: 'Reimburse' },
    ...(editingExpense?.paid_from_imprest ? [{ id: IMPREST, name: 'Imprest (Site float)' }] : []),
  ]
  const defaultAccountId = accountOptions.find((a) => a.name === 'Kotak')?.id ?? CASH
  // No visible GPS UI — still silently captured on mount and submitted with the transaction.
  const { geo } = useGeolocation()

  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const createUnit = useCreateExpenseUnit()

  const [costCenterOverride, setCostCenterOverride] = useState<string | null>(null)
  const [projectId, setProjectId] = useState(() => loadStoredProject())
  const [majorHeadFilter, setMajorHeadFilter] = useState<number | ''>('')
  const [subHeadId, setSubHeadId] = useState('')
  const [amount, setAmount] = useState('0')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('Nos')
  const [rate, setRate] = useState('0')
  const [additionalAmount, setAdditionalAmount] = useState('0')
  const [showCalc, setShowCalc] = useState(false)
  const [addGst, setAddGst] = useState(false)
  const [gstPct, setGstPct] = useState(0)
  // Whether the value the user typed already has GST baked in (so the base
  // gets backed out of it) or is pre-tax (so GST adds on top) — the user
  // picks explicitly every time via the pills in the GST popup, rather than
  // this being inferred from which cost center/field layout is active.
  const [gstInclusive, setGstInclusive] = useState(true)
  const [showGstModal, setShowGstModal] = useState(false)
  const [gstPctDraft, setGstPctDraft] = useState('18')
  const [gstAmountDraft, setGstAmountDraft] = useState('0')
  const [gstInclusiveDraft, setGstInclusiveDraft] = useState(true)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayStr())
  // A trip entry's date comes from the Trips header's date picker instead of
  // a field in this form.
  const effectiveDate = tripId ? tripDate ?? todayStr() : date
  const [remarks, setRemarks] = useState('')
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptStatus, setReceiptStatus] = useState('Take photo')
  // Which Description group's options row is open — a group with options
  // has no sub-head of its own, so tapping it just reveals this instead of
  // applying anything.
  const [expandedQuickGroup, setExpandedQuickGroup] = useState<string | null>(null)
  // Exactly which Description button was tapped — e.g. "Transport>Fuel" vs
  // "Miscellaneous". Several buttons can resolve to the identical sub-head
  // (Leisure, the standalone Miscellaneous, and Transport's own Miscellaneous
  // option all post to 100.1), so matching by sub-head id alone would light
  // up all of them at once. This key is what keeps exactly one highlighted.
  const [selectedQuickKey, setSelectedQuickKey] = useState<string | null>(null)
  // '' = no explicit pick yet — resolves to Kotak (or Cash, if that account
  // isn't around) via defaultAccountId below, so the default stays correct
  // even if bank accounts are renamed or reordered later.
  const [accountId, setAccountId] = useState('')
  const effectiveAccountId = accountId || defaultAccountId
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)

  const activeProjects = projects?.filter((p) => p.status === 'active')
  const defaultCostCenter = costCenters?.[0]?.name ?? ''
  // Cost center is now just a tag for which of the three flows an entry
  // came from — Admin, Trips, or Project — not a business category picked
  // per entry. A brand-new, non-trip, non-project entry is an Admin expense
  // by definition. Editing an existing record re-derives this from what's
  // actually stored, so it stays editable either way.
  const isAdminEntry = !tripId && !lockToProjects && (editingExpense ? editingExpense.cost_center === 'Admin' : true)
  // Under a trip, the cost center is always "Trips" — the trip's own
  // (optional) project is tracked separately via hasProject below, not
  // through this. The Project section locks its own cost center but still
  // lets the project be picked per entry (below).
  const costCenter = tripId ? fixedCostCenter ?? '' : lockToProjects ? 'Project' : isAdminEntry ? 'Admin' : costCenterOverride ?? defaultCostCenter
  const isProjectCostCenter = costCenter === 'Project'
  // Qty x Rate line-item billing only makes sense for standalone project
  // costs — trip spends are always a straight amount.
  const showQtyRateFields = isProjectCostCenter && !tripId
  // Whether Description quick-tap is doing the sub-head picking instead of
  // the raw Major Head / Sub-head accounting picker below.
  const usesQuickTap = !!tripId || isAdminEntry
  // Admin expenses get the same Description → Sub Head quick-tap as trips.
  // Project costs use the accounting picker (Major head capsule buttons,
  // Sub-head dropdown) instead — see the dedicated rows below. Editing an
  // older record whose cost center isn't one of the three current tags
  // keeps the plain dropdown pair too, since there's no quick-tap set for it.
  const activeQuickCategories: QuickCategory[] = tripId
    ? TRIP_QUICK_CATEGORIES
    : isAdminEntry
      ? ADMIN_QUICK_CATEGORIES
      : []
  const effectiveProjectId = tripId ? fixedProjectId ?? '' : projectId
  const selectedProject = projects?.find((p) => p.id === effectiveProjectId)
  const selectedProjectClient = selectedProject ? clients?.find((c) => c.id === selectedProject.client_id) : null
  // Whether this entry should carry a project_id at all — for a trip that's
  // whether the trip itself has one (independent of cost center, which is
  // always "Trips"); everywhere else it follows the Project cost center.
  const hasProject = tripId ? !!effectiveProjectId : isProjectCostCenter
  const projectTotal = (Number(qty) || 0) * parseINR(rate) + parseINR(additionalAmount)
  const enteredAmount = showQtyRateFields ? projectTotal : parseINR(amount)
  // Inclusive: the typed figure already has GST baked in (a receipt total),
  // so the base is backed out of it. Exclusive: the typed figure is pre-tax
  // (unit pricing), so GST adds on top and inflates the total shown below.
  const baseAmount = addGst && gstInclusive ? enteredAmount / (1 + gstPct / 100) : enteredAmount
  const gstAmount = addGst ? (gstInclusive ? enteredAmount - baseAmount : (baseAmount * gstPct) / 100) : 0
  const displayAmount = baseAmount + gstAmount

  // The GST popup lets either field drive the other — pick a rate and the
  // rupee amount fills in, or type the rupee amount and the rate is backed
  // out of it — both against whatever's typed in Amount (or Qty×Rate) and
  // whichever Inclusive/Exclusive pill is picked there.
  function gstAmountForPct(pct: number, inclusive: boolean): number {
    if (inclusive) {
      const base = enteredAmount / (1 + pct / 100)
      return enteredAmount - base
    }
    return (enteredAmount * pct) / 100
  }
  function gstPctForAmount(amt: number, inclusive: boolean): number {
    if (amt <= 0) return 0
    const base = inclusive ? enteredAmount - amt : enteredAmount
    if (base <= 0) return 0
    return (amt / base) * 100
  }

  // Major Head / Sub-Head (Chart of Accounts) — feeds the manual dropdown
  // pair below, which shows on the Project section (Employee & Labour,
  // Equipment & Machinery, Site/Project Overheads) and when editing a legacy
  // T&M expense — the latter needs every major head selectable, not just
  // Project's own, so the filter only applies when actually on that page.
  const PROJECT_MAJOR_HEAD_CODES = [10, 30, 60]
  const majorHeads = Array.from(new Map((subHeads ?? []).map((s) => [s.major_head_code, s.major_head])).entries())
    .filter(([code]) => (lockToProjects ? PROJECT_MAJOR_HEAD_CODES.includes(code) : true))
    .sort((a, b) => a[0] - b[0])
    .map(([code, name]) => ({ code, name }))
  // Only feeds the manual Major Head / Sub-head pickers below, which trips
  // don't use — Description covers sub-head selection there instead.
  const subHeadOptions = majorHeadFilter === '' ? [] : (subHeads ?? []).filter((s) => s.major_head_code === majorHeadFilter)
  const selectedSubHead = subHeads?.find((s) => s.id === subHeadId)
  const topTags = (selectedSubHead?.tags ?? []).map((t) => `#${t}`)

  // Hydrate the Major Head filter from the saved sub-head once sub-heads
  // have loaded — covers both editing an existing expense and the async
  // fetch racing the mount effect below.
  useEffect(() => {
    if (!subHeadId || !subHeads) return
    const sh = subHeads.find((s) => s.id === subHeadId)
    if (sh) setMajorHeadFilter(sh.major_head_code)
  }, [subHeadId, subHeads])

  useEffect(() => {
    if (!editingExpense) return
    setCostCenterOverride(editingExpense.cost_center ?? null)
    setProjectId(editingExpense.project_id ?? '')
    setSubHeadId(editingExpense.sub_head_id ?? '')
    setAmount(String(editingExpense.amount))
    setQty(editingExpense.qty != null ? String(editingExpense.qty) : '')
    setUnit(editingExpense.unit ?? 'Nos')
    setRate(editingExpense.rate != null ? String(editingExpense.rate) : '0')
    setAdditionalAmount(editingExpense.additional_amount != null ? String(editingExpense.additional_amount) : '0')
    setAddGst((editingExpense.gst_pct ?? 0) > 0)
    setGstPct(editingExpense.gst_pct ?? 0)
    // The stored amount is already the ex-GST base, not what was originally
    // typed — treating it as Exclusive here (base unchanged, GST re-added on
    // top for display) avoids silently re-extracting GST a second time.
    setGstInclusive(false)
    setDescription(editingExpense.description)
    setDate(editingExpense.date)
    setRemarks(editingExpense.remarks ?? '')
    setAccountId(
      editingExpense.paid_from_imprest
        ? IMPREST
        : editingExpense.reimbursable
          ? REIMBURSE
          : editingExpense.bank_account_id ?? CASH
    )
    setReceiptBlob(null)
    setReceiptStatus(editingExpense.receipt_path ? 'Photo attached' : 'Take photo')
    setShowCalc(false)
    setFormError(null)
    setLastCreatedId(null)
  }, [editingExpense])

  function handleCostCenterChange(name: string) {
    setCostCenterOverride(name)
  }

  function applyQuickCategory(subHeadCode: string, label: string, key: string) {
    const sh = subHeads?.find((s) => s.code === subHeadCode)
    if (!sh) return
    setMajorHeadFilter(sh.major_head_code)
    setSubHeadId(sh.id)
    setDescription(label)
    // Row stays open after picking — the highlighted pill IS the
    // confirmation that it was recorded; nothing forces it shut.
    setSelectedQuickKey(key)
  }

  function handleQuickCategoryClick(c: QuickCategory) {
    if (c.options) {
      if (expandedQuickGroup === c.label) {
        // Already open — just collapse it, keep whatever was picked.
        setExpandedQuickGroup(null)
      } else {
        // Opening a different group means starting a fresh pick — only one
        // Description selection stands at a time, so clear the old one.
        setExpandedQuickGroup(c.label)
        setSubHeadId('')
        setMajorHeadFilter('')
        setDescription('')
        setSelectedQuickKey(null)
      }
    } else if (c.subHeadCode) {
      // A plain pick is final — close out any group the user was browsing.
      setExpandedQuickGroup(null)
      applyQuickCategory(c.subHeadCode, c.label, c.label)
    }
  }

  // A group with options highlights as soon as it's expanded — before its
  // sub-head is even picked — or if one of its own options is the one
  // selected. A plain group only highlights once it's the one selected.
  // Matched by selectedQuickKey, not sub-head id, so buttons that happen to
  // share a sub-head (see the note by its declaration) don't all light up.
  function isQuickCategoryActive(c: QuickCategory) {
    if (c.options) {
      if (expandedQuickGroup === c.label) return true
      return c.options.some((o) => selectedQuickKey === `${c.label}>${o.label}`)
    }
    return selectedQuickKey === c.label
  }

  function handleProjectChange(id: string) {
    setProjectId(id)
    storeProject(id)
  }

  function handleSubHeadChange(id: string) {
    setSubHeadId(id)
    // On a trip, the sub-head choice itself says what the spend was for —
    // no separate description to type. Manual entry (outside Quick category)
    // still needs a description, so fall back to the sub-head's own name.
    if (tripId) {
      const sh = subHeads?.find((s) => s.id === id)
      setDescription(sh?.name ?? '')
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
    setCostCenterOverride(null)
    setMajorHeadFilter('')
    setSubHeadId('')
    setAmount('0')
    setQty('')
    setUnit('Nos')
    setRate('0')
    setAdditionalAmount('0')
    setAddGst(false)
    setGstPct(0)
    setGstInclusive(true)
    setDescription('')
    // projectId deliberately not reset — it stays the default for the rest
    // of the day (see loadStoredProject), across repeated entries.
    setAccountId('')
    setRemarks('')
    setReceiptBlob(null)
    setReceiptStatus('Take photo')
    setDate(todayStr())
    setShowCalc(false)
    setExpandedQuickGroup(null)
    setSelectedQuickKey(null)
  }

  function handleCancel() {
    resetForm()
    onDoneEditing()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (isProjectCostCenter && !effectiveProjectId) {
      setFormError('Pick a project.')
      return
    }
    if (showQtyRateFields && (!qty || Number(qty) <= 0)) {
      setFormError('Enter a quantity.')
      return
    }
    if (!subHeadId) {
      setFormError(usesQuickTap ? 'Pick a description.' : 'Pick a major head and sub-head.')
      return
    }
    if (!description.trim()) {
      setFormError('Description is required.')
      return
    }
    if (baseAmount <= 0) {
      setFormError('Enter an amount.')
      return
    }

    setSubmitting(true)
    try {
      let receiptPath: string | null = editingExpense?.receipt_path ?? null
      if (receiptBlob) {
        receiptPath = await uploadReceipt(receiptBlob)
      }
      if (showQtyRateFields && unit.trim() && !units?.some((u) => u.name === unit.trim())) {
        createUnit.mutate(unit.trim())
      }
      const patch = {
        description: description.trim(),
        project_id: hasProject ? effectiveProjectId || null : null,
        cost_center: costCenter || null,
        sub_head_id: subHeadId || null,
        amount: baseAmount,
        gst_pct: addGst ? gstPct : 0,
        qty: showQtyRateFields ? Number(qty) || null : null,
        unit: showQtyRateFields ? unit.trim() || null : null,
        rate: showQtyRateFields ? parseINR(rate) || null : null,
        additional_amount: showQtyRateFields ? parseINR(additionalAmount) || 0 : null,
        date: effectiveDate,
        reimbursable: effectiveAccountId === REIMBURSE,
        paid_from_imprest: effectiveAccountId === IMPREST,
        remarks: remarks.trim() || null,
        receipt_path: receiptPath,
        payment_mode:
          effectiveAccountId === REIMBURSE || effectiveAccountId === IMPREST
            ? null
            : effectiveAccountId === CASH
              ? 'Cash'
              : 'Bank',
        bank_account_id:
          effectiveAccountId === REIMBURSE || effectiveAccountId === CASH || effectiveAccountId === IMPREST
            ? null
            : effectiveAccountId,
        trip_id: tripId ?? editingExpense?.trip_id ?? null,
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
    <details className="toggle-section exp-compact-section" open>
      <summary style={{ fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{editingExpense ? 'Edit transaction' : 'Add transaction'}</span>
        <button
          type="button"
          className={addGst ? 'pill active' : 'pill'}
          onClick={(e) => {
            // Inside <summary>, a click's default action toggles the
            // <details> open/closed — preventing it keeps this button from
            // also collapsing the form every time it's tapped.
            e.preventDefault()
            e.stopPropagation()
            const initialPct = gstPct > 0 ? gstPct : 18
            const initialInclusive = addGst ? gstInclusive : !showQtyRateFields
            setGstPctDraft(String(initialPct))
            setGstAmountDraft(String(Math.round(gstAmountForPct(initialPct, initialInclusive) * 100) / 100))
            setGstInclusiveDraft(initialInclusive)
            setShowGstModal(true)
          }}
        >
          {addGst ? `GST ${gstPct}% — ${fmt(gstAmount)}` : 'GST'}
        </button>
      </summary>

      <form className="form-grid exp-compact" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
        {/* Row 1: Cost center — fixed by the trip when entering trip expenses,
            so there's nothing to pick here (the page header already says
            Trips). Date comes from the Trips header's date picker instead of
            a field here; the trip's project, if any, is still noted below. */}
        {tripId ? (
          hasProject ? (
            <div className="field full">
              <div className="note" style={{ margin: 0, fontSize: 11 }}>({selectedProject?.name ?? '—'})</div>
            </div>
          ) : null
        ) : isAdminEntry || lockToProjects ? null : (
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
        )}

        {/* Row 2: Project + Client, only when "Projects" is the cost center
            and not already fixed by a trip above */}
        {isProjectCostCenter && !tripId && (
          <div className="field-row exp-project-row">
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

        {/* Quick categories — one tap sets Major Head, Sub-Head, and the
            description, so logging on the go doesn't need the full Major
            Head → Sub-Head picker underneath. A category with options has
            no sub-head of its own — tapping it reveals those instead, and
            the actual sub-head is set by tapping one of them. Trips get
            their own set (Transport/Consumables/Other); NAN/DDN office
            costs get the Admin set (Office/Marketing/Professional/Finance/
            Misc) — Project and T&M costs still use the dropdown below. */}
        {activeQuickCategories.length > 0 && (
          <div className="field full exp-quick-category">
            <label>Description</label>
            <div className="pill-tabs">
              {activeQuickCategories.map((c) => {
                const active = isQuickCategoryActive(c)
                return (
                  <button
                    key={c.label}
                    type="button"
                    className={active ? 'pill active' : 'pill'}
                    onClick={() => handleQuickCategoryClick(c)}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            {activeQuickCategories.map((c) => {
              if (!c.options || expandedQuickGroup !== c.label) return null
              return (
                <div key={c.label} style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12 }}>Sub-heads</label>
                  <div className="pill-tabs" style={{ marginTop: 4 }}>
                  {c.options.map((opt) => {
                    const active = selectedQuickKey === `${c.label}>${opt.label}`
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        className={active ? 'pill active' : 'pill'}
                        onClick={() => applyQuickCategory(opt.subHeadCode, opt.label, `${c.label}>${opt.label}`)}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Project's own accounting picker — Major head as capsule buttons
            (just the 3 heads Project spend can post to), Sub-head as a
            dropdown scoped to whichever major head is picked. */}
        {lockToProjects && (
          <div className="field full">
            <label>Major head</label>
            <div className="pill-tabs">
              {majorHeads.map((h) => (
                <button
                  key={h.code}
                  type="button"
                  className={majorHeadFilter === h.code ? 'pill active' : 'pill'}
                  onClick={() => {
                    setMajorHeadFilter(h.code)
                    setSubHeadId('')
                  }}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {lockToProjects && (
          <div className="field full">
            <label>Sub-head</label>
            <SearchableSelect
              items={subHeadOptions}
              value={subHeadId}
              onChange={handleSubHeadChange}
              getId={(s) => s.id}
              getLabel={(s) => s.name}
              placeholder={majorHeadFilter === '' ? '— Pick a major head first —' : '— Select sub-head —'}
            />
          </div>
        )}

        {/* Row 2b: Major Head / Sub-Head — Chart of Accounts. Hidden
            whenever Description above is doing the job instead (trips and
            NAN/DDN admin costs) — Major Head is still tracked underneath
            via the hydration effect for the ledger join either way. Still
            used for legacy T&M costs, which don't have a quick-tap set yet
            (Project entries use their own picker above instead). */}
        {!tripId && !isAdminEntry && !lockToProjects && (
          <div className="field-row exp-taxonomy-row">
            <div className="field">
              <label>Major head</label>
              <SearchableSelect
                items={majorHeads}
                value={majorHeadFilter === '' ? '' : String(majorHeadFilter)}
                onChange={(v) => {
                  setMajorHeadFilter(v === '' ? '' : Number(v))
                  setSubHeadId('')
                }}
                getId={(h) => String(h.code)}
                getLabel={(h) => h.name}
                placeholder="— Select major head —"
              />
            </div>
            <div className="field">
              <label>Sub-head</label>
              <SearchableSelect
                items={subHeadOptions}
                value={subHeadId}
                onChange={handleSubHeadChange}
                getId={(s) => s.id}
                getLabel={(s) => s.name}
                placeholder={majorHeadFilter === '' ? '— Pick a major head first —' : '— Select sub-head —'}
              />
            </div>
          </div>
        )}

        {/* Row 3: Description — not shown wherever the Description quick-tap
            above already says what it was for. */}
        {!usesQuickTap && (
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              required
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {topTags.length > 0 && !usesQuickTap && (
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

        {/* Row 4: Date + Amount — or, for a standalone project cost, Qty x
            Unit x Rate then Additional amount + Date, with the total shown
            by the submit button. Trips always get the simple Date + Amount
            row, even when booked to a project. */}
        {showQtyRateFields ? (
          <>
            <div className="field-row exp-qty-row">
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
            {/* Date already sits up in the Cost center row on trips —
                only show it here for non-trip entries. */}
            {!tripId && (
              <div className="field field-narrow">
                <label>Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            )}
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
                    height: 36,
                    boxSizing: 'border-box',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16,
                    fontWeight: 500,
                    padding: '0 10px',
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="calc-btn"
                  style={{
                    height: 36,
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
        {addGst && (
          <div className="note" style={{ margin: '-6px 0 0', gridColumn: '1 / -1' }}>
            {gstInclusive ? 'Incl.' : 'Excl.'} GST — Excl. GST: {fmt(baseAmount)} · GST ({gstPct}%): {fmt(gstAmount)} · Total: {fmt(displayAmount)}
          </div>
        )}
        {showCalc && !showQtyRateFields && (
          <InlineCalculator
            onResult={(value) => {
              setAmount(String(value))
              setShowCalc(false)
            }}
          />
        )}

        {showGstModal && (
          <Modal title="GST" onClose={() => setShowGstModal(false)}>
            <div className="field">
              <label>Is the entered value inclusive or exclusive of GST?</label>
              <div className="pill-tabs">
                <button
                  type="button"
                  className={gstInclusiveDraft ? 'pill active' : 'pill'}
                  onClick={() => {
                    setGstInclusiveDraft(true)
                    const pct = Number(gstPctDraft) || 0
                    setGstAmountDraft(String(Math.round(gstAmountForPct(pct, true) * 100) / 100))
                  }}
                >
                  Inclusive — adjust it out
                </button>
                <button
                  type="button"
                  className={!gstInclusiveDraft ? 'pill active' : 'pill'}
                  onClick={() => {
                    setGstInclusiveDraft(false)
                    const pct = Number(gstPctDraft) || 0
                    setGstAmountDraft(String(Math.round(gstAmountForPct(pct, false) * 100) / 100))
                  }}
                >
                  Exclusive — add it on top
                </button>
              </div>
            </div>
            <div className="pill-tabs" style={{ marginTop: 12 }}>
              {GST_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={Number(gstPctDraft) === r ? 'pill active' : 'pill'}
                  onClick={() => {
                    setGstPctDraft(String(r))
                    setGstAmountDraft(String(Math.round(gstAmountForPct(r, gstInclusiveDraft) * 100) / 100))
                  }}
                >
                  {r}%
                </button>
              ))}
            </div>
            <div className="field-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gstPctDraft}
                  onChange={(e) => {
                    setGstPctDraft(e.target.value)
                    const pct = Number(e.target.value) || 0
                    setGstAmountDraft(String(Math.round(gstAmountForPct(pct, gstInclusiveDraft) * 100) / 100))
                  }}
                />
              </div>
              <div className="field">
                <label>GST amount (₹)</label>
                <CurrencyInput
                  value={gstAmountDraft}
                  onValueChange={(v) => {
                    setGstAmountDraft(v)
                    const pct = gstPctForAmount(parseINR(v), gstInclusiveDraft)
                    setGstPctDraft(String(Math.round(pct * 100) / 100))
                  }}
                />
              </div>
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              {gstInclusiveDraft
                ? (() => {
                    const pct = Number(gstPctDraft) || 0
                    const base = enteredAmount / (1 + pct / 100)
                    return `${fmt(enteredAmount)} incl. ${pct}% GST = ${fmt(base)} excl. GST + ${fmt(enteredAmount - base)} GST`
                  })()
                : (() => {
                    const pct = Number(gstPctDraft) || 0
                    return `${fmt(enteredAmount)} + ${pct}% GST = ${fmt(enteredAmount + (enteredAmount * pct) / 100)}`
                  })()}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button
                type="button"
                onClick={() => {
                  setAddGst(true)
                  setGstPct(Number(gstPctDraft) || 0)
                  setGstInclusive(gstInclusiveDraft)
                  setShowGstModal(false)
                }}
              >
                Apply
              </Button>
              {addGst && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAddGst(false)
                    setGstPct(0)
                    setShowGstModal(false)
                  }}
                >
                  Remove GST
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setShowGstModal(false)}>
                Cancel
              </Button>
            </div>
          </Modal>
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
          <div className="field exp-account" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <label>Account</label>
            {/* Pills stay usable up to a handful of accounts; beyond that a
                searchable dropdown scales better than a wall of buttons. */}
            {accountOptions.length <= 5 ? (
              <div className="pill-tabs">
                {accountOptions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={effectiveAccountId === a.id ? 'pill active' : 'pill'}
                    onClick={() => setAccountId(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <SearchableSelect
                items={accountOptions}
                value={effectiveAccountId}
                onChange={setAccountId}
                getId={(a) => a.id}
                getLabel={(a) => a.name}
                placeholder="— Select account —"
              />
            )}
          </div>
          {!tripId && (
            <div className="field exp-receipt" style={{ flex: '0 0 auto' }}>
              <ReceiptUploadButton
                idPrefix="e-receipt"
                hasFile={!!receiptBlob}
                status={receiptStatus}
                onFile={handleReceiptFile}
              />
            </div>
          )}
        </div>
        <div className="field full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button type="submit" disabled={submitting} style={{ flex: editingExpense ? undefined : '1 1 auto' }}>
            {submitting ? 'Saving…' : editingExpense ? `Save — ${fmt(displayAmount)}` : `Add — ${fmt(displayAmount)}`}
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
