import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { InlineCalculator } from '../../components/InlineCalculator'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useProjects, useVendors } from '../../lib/queries/masters'
import { useCreateTeamTracker, useTeamTracker, useCreateTeamTrackerPayment } from '../../lib/queries/team'
import { parseINR, fmtPlain } from '../../lib/calc/format'
import { useAuth } from '../../lib/auth'
import { ContractorCombobox } from './ContractorCombobox'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function CalculatorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export function TeamTrackerForm() {
  const { profile } = useAuth()
  const canAddContractor = profile?.role === 'admin' || profile?.role === 'cxo'
  const { data: projects } = useProjects()
  const { data: vendors } = useVendors()
  const contractors = vendors?.filter((v) => v.category === 'Contractor')
  const { data: allEntries } = useTeamTracker(null)
  const createTeamTracker = useCreateTeamTracker()
  const createPayment = useCreateTeamTrackerPayment()

  const [date, setDate] = useState(todayStr())
  const [projectId, setProjectId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('0')
  const [otherExpenses, setOtherExpenses] = useState('0')
  const [total, setTotal] = useState('0')
  const [showCalc, setShowCalc] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Set right after "Log entry" succeeds, so the payment row can offer an
  // immediate payment against that specific new entry without leaving this form.
  const [justCreated, setJustCreated] = useState<{ id: string; due: number } | null>(null)
  const [paidAmount, setPaidAmount] = useState('0')
  const [recordingPayment, setRecordingPayment] = useState(false)

  const tagCounts: Record<string, number> = {}
  allEntries?.forEach((t) => {
    const matches = (t.remarks || '').match(/#\w+/g) || []
    matches.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t)

  /** Total = (Manpower qty x Rate per person) + Other expenses */
  function recomputeTotal(nextQty: string, nextRate: string, nextOther: string) {
    const q = Number(nextQty || 0)
    const r = parseINR(nextRate)
    const o = parseINR(nextOther)
    setTotal(String(q * r + o))
  }

  function handleQtyChange(value: string) {
    setQty(value)
    recomputeTotal(value, rate, otherExpenses)
  }

  function handleRateChange(value: string) {
    setRate(value)
    recomputeTotal(qty, value, otherExpenses)
  }

  function handleOtherExpensesChange(value: string) {
    setOtherExpenses(value)
    recomputeTotal(qty, rate, value)
  }

  function insertTag(tag: string) {
    setRemarks((prev) => (prev.trim() + ' ' + tag).trim())
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!projectId) {
      setFormError('Pick a project.')
      return
    }
    if (!supplier.trim()) {
      setFormError('Supplier name is required.')
      return
    }
    setSubmitting(true)
    try {
      const created = await createTeamTracker.mutateAsync({
        date,
        project_id: projectId,
        supplier: supplier.trim(),
        qty: qty ? Number(qty) : null,
        rate: parseINR(rate) || null,
        total: parseINR(total) || null,
        remarks: remarks.trim() || null,
      })
      const dueForNewEntry = Number(created.total || 0)
      setDate(todayStr())
      setProjectId('')
      setSupplier('')
      setQty('')
      setRate('0')
      setOtherExpenses('0')
      setTotal('0')
      setRemarks('')
      if (dueForNewEntry > 0) {
        setJustCreated({ id: created.id, due: dueForNewEntry })
        setPaidAmount(fmtPlain(dueForNewEntry).replace(/,/g, ''))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log entry.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRecordPayment() {
    if (!justCreated) return
    const amt = parseINR(paidAmount)
    if (amt <= 0) return
    setRecordingPayment(true)
    try {
      await createPayment.mutateAsync({
        team_tracker_id: justCreated.id,
        date: todayStr(),
        amount: amt,
      })
      setJustCreated(null)
      setPaidAmount('0')
    } finally {
      setRecordingPayment(false)
    }
  }

  if (profile?.role === 'staff') {
    return (
      <details className="toggle-section" open>
        <summary>Team tracker</summary>
        <div className="note" style={{ marginTop: 16 }}>
          You have view-only access to Team tracker.
        </div>
      </details>
    )
  }

  return (
    <details className="toggle-section" open>
      <summary>Team tracker</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        {/* Row 1: Date, Project — forced side by side on mobile */}
        <div className="field-row tt-row1">
          <div className="field tt-date">
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field tt-project">
            <label>Project</label>
            <SearchableSelect
              items={projects}
              value={projectId}
              onChange={setProjectId}
              getId={(p) => p.id}
              getLabel={(p) => p.name}
              placeholder="— Select project —"
            />
          </div>
        </div>

        {/* Row 2: Name of supplier */}
        <div className="field full tt-supplier">
          <label>Name of supplier</label>
          <ContractorCombobox
            contractors={contractors}
            value={supplier}
            onChange={setSupplier}
            allowCreate={canAddContractor}
          />
        </div>

        {/* Row 3: Qty, Rate — forced side by side on mobile */}
        <div className="field-row tt-row3">
          <div className="field tt-qty">
            <label>Manpower qty (optional)</label>
            <input type="number" min="0" step="1" value={qty} onChange={(e) => handleQtyChange(e.target.value)} />
          </div>
          <div className="field tt-rate">
            <label>Rate per person (₹)</label>
            <CurrencyInput value={rate} onValueChange={handleRateChange} />
          </div>
        </div>

        {/* Row 4: Calculator, Other expenses, Total — Total = (Qty x Rate) + Other expenses */}
        <div className="field-row tt-row4">
          <div className="field tt-calc-btn" style={{ justifyContent: 'flex-end' }}>
            <label>&nbsp;</label>
            <Button
              type="button"
              variant="secondary"
              className="tt-calc-icon-btn"
              title="Open calculator for Misc"
              onClick={() => setShowCalc((v) => !v)}
            >
              <CalculatorIcon />
            </Button>
          </div>
          <div className="field tt-other-expenses">
            <label>Misc (₹)</label>
            <CurrencyInput value={otherExpenses} onValueChange={handleOtherExpensesChange} />
          </div>
          <div className="field tt-total">
            <label>Total (₹)</label>
            <CurrencyInput value={total} onValueChange={setTotal} />
          </div>
        </div>
        {showCalc && (
          <div style={{ gridColumn: '1 / -1' }}>
            <InlineCalculator
              onResult={(value) => {
                const v = String(value)
                setOtherExpenses(v)
                recomputeTotal(qty, rate, v)
                setShowCalc(false)
              }}
            />
          </div>
        )}

        {/* Row 5: Log entry, alone */}
        <div className="field full tt-log-entry">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Logging…' : 'Log entry'}
          </Button>
        </div>

        {/* Row 6: appears only right after Log entry, to pay against that new entry */}
        {justCreated && (
          <div className="field-row tt-row6">
            <div className="field tt-amount-paid">
              <label>Amount paid</label>
              <CurrencyInput value={paidAmount} onValueChange={setPaidAmount} />
            </div>
            <div className="field tt-record-btn" style={{ justifyContent: 'flex-end' }}>
              <label>&nbsp;</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" onClick={handleRecordPayment} disabled={recordingPayment}>
                  {recordingPayment ? 'Saving…' : 'Record payment'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setJustCreated(null)}>
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Row 7: Remarks */}
        <div className="field full">
          <label>Remarks</label>
          <input
            type="text"
            placeholder="Use #tags to make entries searchable"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
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
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}
    </details>
  )
}
