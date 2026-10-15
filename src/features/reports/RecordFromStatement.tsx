import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { SearchableSelect } from '../../components/SearchableSelect'
import { billDue } from '../../lib/calc/vendorBills'
import { dueAmount, retentionHeld, round2 } from '../../lib/calc/invoices'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { useGoTo } from '../../lib/navContext'
import type { StatementLine } from '../../lib/import/bankStatement'
import { useBankAccounts, useClients, useExpenseSubHeads, useProjects, useVendors } from '../../lib/queries/masters'
import { useCreateTransfer } from '../../lib/queries/transfers'
import { useProfiles } from '../../lib/queries/admin'
import { useTrips } from '../../lib/queries/trips'
import { TRIP_QUICK_CATEGORIES } from '../../lib/tripQuickCategories'
import { useCreateCapitalTx } from '../../lib/queries/capital'
import { useCreateLoan, useCreateLoanPayment, useLoanPayments, useLoans } from '../../lib/queries/loans'
import { loanOutstanding } from '../../lib/calc/loans'
import { useCreateExpense, useCreateExpenseReimbursement } from '../../lib/queries/expenses'
import { allocateSettlement } from '../../lib/calc/expenses'
import { useReimbursementDue } from '../dashboard/useReimbursementDue'
import { useCreateVendorAdvance, useCreateVendorBillPayment, useVendorBillPayments, useVendorBills } from '../../lib/queries/purchases'
import { useCreateInvoicePayment, useInvoicePayments, useInvoices } from '../../lib/queries/invoices'

type Kind = 'transfer' | 'expense' | 'trip' | 'reimbursement' | 'vendor' | 'vendoradvance' | 'receipt' | 'capital' | 'loan' | 'loanpay'

const CASH = 'cash'
const KIND_LABEL: Record<Kind, string> = {
  transfer: 'Transfer between my accounts',
  expense: 'Expense (bank charges, site cost ...)',
  trip: 'Trip expense (fuel, meals, tickets, lodging ...)',
  reimbursement: 'Reimbursement to an employee (money they paid out of pocket)',
  vendor: 'Payment to a vendor (against a bill)',
  vendoradvance: 'Advance to a vendor (no bill yet)',
  receipt: 'Receipt from a client',
  capital: 'Capital (money a partner puts in or takes out)',
  loan: 'A new loan received',
  loanpay: 'Repayment of a loan',
}

/** A form opened from a bank statement line that is not in the books yet. The date, amount, account and
 * text come from the statement; you choose what it was and fill in what only you know. */
export function RecordFromStatement({
  line,
  bankAccountId,
  bankName,
  onClose,
}: {
  line: StatementLine
  bankAccountId: string
  bankName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const goTo = useGoTo()
  const incoming = line.deposit > 0
  const amount = incoming ? line.deposit : line.withdrawal
  const kinds: Kind[] = incoming ? ['transfer', 'receipt', 'capital', 'loan'] : ['transfer', 'expense', 'trip', 'reimbursement', 'vendor', 'vendoradvance', 'capital', 'loanpay']

  const { data: banks } = useBankAccounts()
  const { data: clients } = useClients()
  const { data: vendors } = useVendors()
  const { data: projects } = useProjects()
  const { data: subHeads } = useExpenseSubHeads()
  const { data: invoices } = useInvoices(null, { sentOnly: true })
  const { data: invoicePayments } = useInvoicePayments()
  const { data: bills } = useVendorBills(null)
  const { data: billPayments } = useVendorBillPayments()

  const createTransfer = useCreateTransfer()
  const createExpense = useCreateExpense()
  const createVendorPayment = useCreateVendorBillPayment()
  const createVendorAdvance = useCreateVendorAdvance()
  const createReceipt = useCreateInvoicePayment()
  const createCapital = useCreateCapitalTx()
  const createLoan = useCreateLoan()
  const createLoanPayment = useCreateLoanPayment()
  const createReimbursement = useCreateExpenseReimbursement()
  const dueRows = useReimbursementDue()
  const { data: profiles } = useProfiles()
  const { data: loans } = useLoans(null)
  const { data: loanPayments } = useLoanPayments()
  const { data: trips } = useTrips()

  const [kind, setKind] = useState<Kind>(kinds[0])
  const [date, setDate] = useState(line.date)
  const [reference, setReference] = useState(line.reference || '')
  const [notes, setNotes] = useState(line.description)
  const [otherId, setOtherId] = useState('')
  const [costCenter, setCostCenter] = useState<'Admin' | 'Project'>('Admin')
  const [projectId, setProjectId] = useState('')
  const [subHeadId, setSubHeadId] = useState('')
  const [gstPct, setGstPct] = useState('0')
  const [expenseVendorId, setExpenseVendorId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [billId, setBillId] = useState('')
  const [clientId, setClientId] = useState('')
  // What part of the payment goes to each invoice (typed amounts), so one transfer can settle several invoices.
  const [invAlloc, setInvAlloc] = useState<Record<string, string>>({})
  const [isRelease, setIsRelease] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [tripId, setTripId] = useState('')
  const [reimbUserId, setReimbUserId] = useState('')
  const [tripCategory, setTripCategory] = useState('')
  const [loanType, setLoanType] = useState<'private' | 'bank'>('bank')
  const [lender, setLender] = useState('')
  const [roiPct, setRoiPct] = useState('')
  const [loanId, setLoanId] = useState('')
  const [interestPart, setInterestPart] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherAccounts = [{ id: CASH, name: 'Cash' }, ...(banks ?? []).filter((b) => b.id !== bankAccountId)]

  // Partners are Admin and CXO only; a supervisor is an employee with no stake in capital.
  const partners = (profiles ?? []).filter((p) => p.role === 'admin' || p.role === 'cxo')
  // Open trips first, then the closed ones, so the current trip is easy to find.
  const tripOptions = useMemo(() => [...(trips ?? [])].sort((a, b) => (a.status === b.status ? b.start_date.localeCompare(a.start_date) : a.status === 'open' ? -1 : 1)), [trips])
  // People the firm owes money to, and (for the one chosen) the entries that money is for, oldest first.
  const owedPeople = dueRows.filter((r) => r.userId)
  const owed = owedPeople.find((r) => r.userId === reimbUserId) ?? null
  const reimbAllocations = owed ? allocateSettlement(amount, owed.outstanding) : []
  const openLoans = useMemo(
    () =>
      (loans ?? [])
        .map((l) => ({ loan: l, outstanding: loanOutstanding(l, (loanPayments ?? []).filter((p) => p.loan_id === l.id)) }))
        .filter((x) => x.outstanding > 0.01),
    [loans, loanPayments]
  )

  const openBills = useMemo(
    () =>
      (bills ?? [])
        .filter((b) => b.vendor_id === vendorId)
        .map((b) => ({ bill: b, due: billDue(b, (billPayments ?? []).filter((p) => p.bill_id === b.id)) }))
        .filter((x) => x.due > 0.01),
    [bills, billPayments, vendorId]
  )
  const openInvoices = useMemo(
    () =>
      (invoices ?? [])
        .filter((i) => i.client_id === clientId)
        .map((i) => {
          const pays = (invoicePayments ?? []).filter((p) => p.invoice_id === i.id)
          return { inv: i, due: dueAmount(i, pays), held: retentionHeld(i, pays) }
        })
        .filter((x) => x.due > 0.01 || x.held > 0.01)
        .sort((a, b) => (a.inv.invoice_date ?? '').localeCompare(b.inv.invoice_date ?? '')),
    [invoices, invoicePayments, clientId]
  )
  const allocated = round2(Object.values(invAlloc).reduce((t, v) => t + (Number(v) || 0), 0))
  const leftToAllocate = round2(amount - allocated)
  /** Fill the invoices oldest first until the payment is used up. */
  function fillOldestFirst() {
    let left = amount
    const next: Record<string, string> = {}
    for (const { inv, due, held } of openInvoices) {
      const cap = isRelease ? held : due
      const part = Math.min(left, cap)
      if (part > 0.005) {
        next[inv.id] = String(round2(part))
        left = round2(left - part)
      }
    }
    setInvAlloc(next)
  }

  async function save() {
    setError(null)
    if (!date) return setError('Pick a date.')
    setSaving(true)
    try {
      if (kind === 'transfer') {
        if (!otherId) throw new Error(incoming ? 'Pick the account the money came from.' : 'Pick the account the money went to.')
        const other = otherId === CASH ? null : otherId
        await createTransfer.mutateAsync({
          from_account_id: incoming ? other : bankAccountId,
          to_account_id: incoming ? bankAccountId : other,
          amount,
          date,
          notes: notes.trim() || null,
        })
      } else if (kind === 'trip') {
        const trip = (trips ?? []).find((t) => t.id === tripId)
        if (!trip) throw new Error('Pick the trip.')
        const subHead = (subHeads ?? []).find((s) => s.code === tripCategory)
        if (!subHead) throw new Error('Pick what the money was spent on.')
        const label = TRIP_QUICK_CATEGORIES.flatMap((c) => c.options ?? []).find((o) => o.subHeadCode === tripCategory)?.label ?? subHead.name
        await createExpense.mutateAsync({
          description: label,
          amount,
          gst_pct: 0,
          date,
          cost_center: trip.cost_center || 'Trips',
          project_id: trip.project_id,
          sub_head_id: subHead.id,
          trip_id: trip.id,
          reimbursable: false,
          paid_from_imprest: false,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
          remarks: notes.trim() ? notes.trim().slice(0, 200) : null,
        })
      } else if (kind === 'reimbursement') {
        if (!owed) throw new Error('Pick the person who is being repaid.')
        if (amount > owed.due + 0.005) throw new Error(`The statement amount (${fmt2(amount)}) is more than the ${fmt2(owed.due)} owed to ${owed.name}. If part of it is something else, record that separately.`)
        // One reimbursement per expense it settles, oldest first, like the Settle button on the dashboard.
        for (const alloc of allocateSettlement(amount, owed.outstanding)) {
          await createReimbursement.mutateAsync({
            ...(alloc.source === 'vendor_payment' ? { vendor_bill_payment_id: alloc.expenseId } : { expense_id: alloc.expenseId }),
            date,
            amount: alloc.amount,
            reference: reference.trim() || null,
            payment_mode: 'Bank',
            bank_account_id: bankAccountId,
          })
        }
      } else if (kind === 'capital') {
        if (!partnerId) throw new Error('Pick the partner.')
        await createCapital.mutateAsync({
          partner_id: partnerId,
          type: incoming ? 'injection' : 'withdrawal',
          amount,
          date,
          notes: notes.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
        })
      } else if (kind === 'loan') {
        if (!lender.trim()) throw new Error('Write who the loan is from.')
        await createLoan.mutateAsync({
          loan_type: loanType,
          lender: lender.trim(),
          principal: amount,
          roi_pct: Number(roiPct) || 0,
          date_taken: date,
          notes: notes.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
        })
      } else if (kind === 'loanpay') {
        if (!loanId) throw new Error('Pick the loan.')
        const interest = Math.max(0, Number(interestPart) || 0)
        if (interest > amount) throw new Error('The interest part cannot be more than the amount on the statement.')
        const principal = round2(amount - interest)
        const chosen = openLoans.find((x) => x.loan.id === loanId)
        if (chosen && principal > chosen.outstanding + 0.01) throw new Error(`The principal part (${fmt2(principal)}) is more than what is still owed on this loan (${fmt2(chosen.outstanding)}). Put the extra in the interest part.`)
        await createLoanPayment.mutateAsync({
          loan_id: loanId,
          date,
          principal_paid: principal,
          interest_paid: round2(interest),
          reference: reference.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
        })
      } else if (kind === 'expense') {
        if (!subHeadId) throw new Error('Pick the type of cost.')
        if (costCenter === 'Project' && !projectId) throw new Error('Pick the project.')
        if (!notes.trim()) throw new Error('Write a short description.')
        const g = Number(gstPct) || 0
        // The statement shows what left the bank, so any GST is already inside it.
        const base = g > 0 ? round2((amount * 100) / (100 + g)) : amount
        await createExpense.mutateAsync({
          description: notes.trim(),
          amount: base,
          gst_pct: g,
          date,
          cost_center: costCenter,
          project_id: costCenter === 'Project' ? projectId : null,
          sub_head_id: subHeadId,
          vendor_id: expenseVendorId || null,
          reimbursable: false,
          paid_from_imprest: false,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
          remarks: reference.trim() ? `Bank ref ${reference.trim()}` : null,
        })
      } else if (kind === 'vendoradvance') {
        if (!vendorId) throw new Error('Pick the vendor.')
        await createVendorAdvance.mutateAsync({
          vendor_id: vendorId,
          date,
          amount,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
        })
      } else if (kind === 'vendor') {
        if (!billId) throw new Error('Pick the bill this payment is for.')
        await createVendorPayment.mutateAsync({
          bill_id: billId,
          date,
          amount,
          reference: reference.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
          paid_by: null,
        })
      } else {
        const parts = openInvoices.map((x) => ({ ...x, part: round2(Number(invAlloc[x.inv.id]) || 0) })).filter((x) => x.part > 0)
        if (parts.length === 0) throw new Error('Say which invoice this payment is for, and how much of it.')
        if (Math.abs(leftToAllocate) > 0.005) {
          throw new Error(
            leftToAllocate > 0
              ? `${fmt2(leftToAllocate)} of the ${fmt2(amount)} is not given to any invoice yet.`
              : `The invoices add up to ${fmt2(allocated)}, which is ${fmt2(-leftToAllocate)} more than the statement amount.`
          )
        }
        for (const x of parts) {
          const cap = isRelease ? x.held : x.due
          if (x.part > cap + 0.005) throw new Error(`${x.inv.invoice_number || x.inv.display_id}: ${fmt2(x.part)} is more than the ${fmt2(cap)} that can still be received on it.`)
        }
        // One payment entry per invoice, all dated the day the money arrived.
        for (const x of parts) {
          await createReceipt.mutateAsync({
            invoice_id: x.inv.id,
            date,
            amount: x.part,
            reference: reference.trim() || null,
            payment_mode: 'Bank',
            bank_account_id: bankAccountId,
            is_retention_release: isRelease,
            gst_component: 0,
          })
        }
      }
      // The new entry should appear in this account's books straight away so it can be matched.
      await qc.invalidateQueries({ queryKey: ['bank_lines'] })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Record this in the books" onClose={onClose}>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>
          {fmtDate(line.date)} · {incoming ? '+' : '-'}
          {fmt2(amount)}
        </strong>{' '}
        on the {bankName} statement
        <div className="retention-note">{line.description}</div>
      </div>

      <div className="field">
        <label htmlFor="rfs-kind">What was it?</label>
        <select id="rfs-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rfs-date">Date</label>
        <input id="rfs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {kind === 'transfer' && (
        <div className="field">
          <label>{incoming ? 'Came from' : 'Went to'}</label>
          <SearchableSelect items={otherAccounts} value={otherId} onChange={setOtherId} getId={(a) => a.id} getLabel={(a) => a.name} />
        </div>
      )}

      {kind === 'expense' && (
        <>
          <div className="field">
            <label htmlFor="rfs-cc">Is it an office cost or a project cost?</label>
            <select id="rfs-cc" value={costCenter} onChange={(e) => setCostCenter(e.target.value as 'Admin' | 'Project')}>
              <option value="Admin">Office (Admin)</option>
              <option value="Project">Project</option>
            </select>
          </div>
          {costCenter === 'Project' && (
            <div className="field">
              <label>Project</label>
              <SearchableSelect items={projects} value={projectId} onChange={setProjectId} getId={(p) => p.id} getLabel={(p) => p.name} />
            </div>
          )}
          <div className="field">
            <label>Type of cost</label>
            <SearchableSelect
              items={subHeads}
              value={subHeadId}
              onChange={setSubHeadId}
              getId={(s) => s.id}
              getLabel={(s) => `${s.major_head} › ${s.name}`}
              placeholder="Bank charges? pick Finance and Banking"
            />
          </div>
          <div className="field">
            <label htmlFor="rfs-gst">GST included in this amount</label>
            <select id="rfs-gst" value={gstPct} onChange={(e) => setGstPct(e.target.value)}>
              <option value="0">No GST</option>
              <option value="5">5 percent</option>
              <option value="12">12 percent</option>
              <option value="18">18 percent (bank charges usually have this)</option>
              <option value="28">28 percent</option>
            </select>
          </div>
          <div className="field">
            <label>Vendor (optional)</label>
            <SearchableSelect items={vendors} value={expenseVendorId} onChange={setExpenseVendorId} getId={(v) => v.id} getLabel={(v) => v.name} placeholder="None" />
          </div>
        </>
      )}

      {kind === 'trip' && (
        <>
          <div className="field">
            <label htmlFor="rfs-trip">Which trip?</label>
            <select id="rfs-trip" value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">Pick a trip</option>
              {tripOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.display_id}
                  {t.status === 'open' ? '' : ' (closed)'}
                </option>
              ))}
            </select>
          </div>
          {tripOptions.length === 0 && <div className="note">There are no trips yet. Create the trip first on the Expenses page, under Trips.</div>}
          <div className="field">
            <label htmlFor="rfs-trip-cat">What was it spent on?</label>
            <select id="rfs-trip-cat" value={tripCategory} onChange={(e) => setTripCategory(e.target.value)}>
              <option value="">Pick one</option>
              {TRIP_QUICK_CATEGORIES.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {(group.options ?? []).map((o) => (
                    <option key={`${group.label}-${o.label}`} value={o.subHeadCode}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="note">It is recorded against the trip and its project, as paid from {bankName}.</div>
        </>
      )}

      {kind === 'reimbursement' && (
        <>
          {owedPeople.length === 0 ? (
            <div className="note">Nobody is owed a reimbursement right now. A cost counts as owed when it was entered as "reimbursable" (paid by a person from their own pocket).</div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="rfs-reimb-user">Who is being repaid?</label>
                <select id="rfs-reimb-user" value={reimbUserId} onChange={(e) => setReimbUserId(e.target.value)}>
                  <option value="">Pick a person</option>
                  {owedPeople.map((r) => (
                    <option key={r.userId} value={r.userId ?? ''}>
                      {r.name} · owed {fmt2(r.due)}
                    </option>
                  ))}
                </select>
              </div>
              {owed && (
                <div className="note">
                  {fmt2(amount)} is split over {reimbAllocations.length} entr{reimbAllocations.length === 1 ? 'y' : 'ies'}, oldest first
                  {amount < owed.due - 0.005 ? `, and ${fmt2(owed.due - amount)} is still owed after this` : ', which clears everything owed to them'}.
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {reimbAllocations.map((a) => {
                      const d = owed.details.find((x) => x.id === a.expenseId)
                      return (
                        <li key={a.expenseId}>
                          {d ? `${fmtDate(d.date)} · ${d.description}` : 'Entry'} · {fmt2(a.amount)}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}

      {kind === 'vendor' && (
        <>
          <div className="field">
            <label>Vendor</label>
            <SearchableSelect
              items={vendors}
              value={vendorId}
              onChange={(v) => {
                setVendorId(v)
                setBillId('')
              }}
              getId={(v) => v.id}
              getLabel={(v) => v.name}
            />
          </div>
          {vendorId && openBills.length === 0 && (
            <div className="note">
              This vendor has no unpaid bill. If this money was paid before the bill, record it as an advance: it is set against the vendor&rsquo;s bills automatically, oldest first, when they are entered.{' '}
              <Button type="button" onClick={() => setKind('vendoradvance')}>
                Record as an advance
              </Button>{' '}
              Or record the bill first in Procurements (it needs the bill date, the type of cost and the amount), then come back.{' '}
              {goTo && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    goTo('purchases')
                    onClose()
                  }}
                >
                  Open Procurements
                </Button>
              )}
            </div>
          )}
          {openBills.length > 0 && (
            <div className="field">
              <label htmlFor="rfs-bill">Which bill is this for?</label>
              <select id="rfs-bill" value={billId} onChange={(e) => setBillId(e.target.value)}>
                <option value="">Pick a bill</option>
                {openBills.map(({ bill, due }) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.display_id} · {fmtDate(bill.date)} · still due {fmt2(due)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {kind === 'vendoradvance' && (
        <>
          <div className="field">
            <label>Vendor</label>
            <SearchableSelect items={vendors} value={vendorId} onChange={setVendorId} getId={(v) => v.id} getLabel={(v) => v.name} />
          </div>
          <div className="note">
            Recorded as money paid to the vendor ahead of a bill, not as a cost. When you enter their bill, the oldest advance is set against it automatically and only the rest is left to pay.
            {vendors && vendors.length > 0 ? '' : ' There are no vendors yet. Add the vendor first in Procurements.'}
          </div>
        </>
      )}

      {kind === 'capital' && (
        <>
          <div className="field">
            <label>Partner</label>
            <SearchableSelect items={partners} value={partnerId} onChange={setPartnerId} getId={(p) => p.id} getLabel={(p) => p.name} placeholder="— Select partner —" />
          </div>
          <div className="note">
            {incoming ? 'This is recorded as money the partner put into the business.' : 'This is recorded as money the partner took out of the business.'} It does not change profit.
          </div>
        </>
      )}

      {kind === 'loan' && (
        <>
          <div className="field">
            <label htmlFor="rfs-loan-type">Type of loan</label>
            <select id="rfs-loan-type" value={loanType} onChange={(e) => setLoanType(e.target.value as 'private' | 'bank')}>
              <option value="bank">Bank loan</option>
              <option value="private">Private loan</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rfs-lender">Lender (who gave the money)</label>
            <input id="rfs-lender" value={lender} onChange={(e) => setLender(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rfs-roi">Interest rate per year, in percent (optional)</label>
            <input id="rfs-roi" inputMode="decimal" value={roiPct} onChange={(e) => setRoiPct(e.target.value)} />
          </div>
          <div className="note">The whole amount on the statement is recorded as the loan taken. Borrowed money is not income.</div>
        </>
      )}

      {kind === 'loanpay' && (
        <>
          {openLoans.length === 0 ? (
            <div className="note">
              There is no loan with money still owed. Record the loan first on the Loans page.{' '}
              {goTo && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    goTo('loans')
                    onClose()
                  }}
                >
                  Open Loans
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="rfs-loan">Which loan?</label>
                <select id="rfs-loan" value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                  <option value="">Pick a loan</option>
                  {openLoans.map(({ loan, outstanding }) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.lender} · {loan.display_id} · still owed {fmt2(outstanding)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="rfs-interest">How much of {fmt2(amount)} was interest?</label>
                <input id="rfs-interest" inputMode="decimal" value={interestPart} onChange={(e) => setInterestPart(e.target.value)} />
              </div>
              <div className="note">
                The rest, {fmt2(Math.max(0, round2(amount - (Number(interestPart) || 0))))}, reduces what you owe. Only the interest part counts as a cost in the Profit and Loss.
              </div>
            </>
          )}
        </>
      )}

      {kind === 'receipt' && (
        <>
          <div className="field">
            <label>Client</label>
            <SearchableSelect
              items={clients}
              value={clientId}
              onChange={(v) => {
                setClientId(v)
                setInvAlloc({})
              }}
              getId={(c) => c.id}
              getLabel={(c) => c.name}
            />
          </div>
          {clientId && openInvoices.length === 0 && <div className="note">This client has no invoice that is due or holding retention. Check that the invoice is marked Sent.</div>}
          {openInvoices.length > 0 && (
            <>
              <div className="note" style={{ marginTop: 0 }}>
                Which invoice or invoices is this payment for? If one transfer paid several invoices, give each its part. The parts must add up to {fmt2(amount)}.
              </div>
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th style={{ textAlign: 'right' }}>{isRelease ? 'Retention held' : 'Still due'}</th>
                      <th style={{ textAlign: 'right' }}>This payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map(({ inv, due, held }) => (
                      <tr key={inv.id}>
                        <td>
                          {inv.invoice_number || inv.display_id}
                          {inv.invoice_date && <div className="retention-note">{fmtDate(inv.invoice_date)}</div>}
                        </td>
                        <td className="amt">{fmt2(isRelease ? held : due)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            aria-label={`Part of the payment for ${inv.invoice_number || inv.display_id}`}
                            inputMode="decimal"
                            style={{ width: 110, textAlign: 'right' }}
                            value={invAlloc[inv.id] ?? ''}
                            onChange={(e) => setInvAlloc({ ...invAlloc, [inv.id]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '6px 0', fontSize: 13, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={fillOldestFirst}>
                  Fill oldest first
                </Button>
                <span style={{ color: Math.abs(leftToAllocate) < 0.005 ? 'var(--green)' : 'var(--amber)' }}>
                  {Math.abs(leftToAllocate) < 0.005
                    ? 'All of the payment is given to invoices.'
                    : leftToAllocate > 0
                      ? `${fmt2(leftToAllocate)} still to give to an invoice.`
                      : `${fmt2(-leftToAllocate)} too much.`}
                </span>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '4px 0 10px' }}>
                <input type="checkbox" checked={isRelease} onChange={(e) => setIsRelease(e.target.checked)} />
                The client is releasing retention money
              </label>
            </>
          )}
        </>
      )}

      {kind !== 'expense' && (
        <div className="field">
          <label htmlFor="rfs-ref">Reference (optional)</label>
          <input id="rfs-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      )}
      {(kind === 'transfer' || kind === 'expense' || kind === 'trip' || kind === 'vendoradvance' || kind === 'capital' || kind === 'loan') && (
        <div className="field">
          <label htmlFor="rfs-notes">{kind === 'expense' ? 'Description' : 'Note (optional)'}</label>
          <input id="rfs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}

      <div className="note">
        It is entered against <strong>{bankName}</strong> for <strong>{fmt2(amount)}</strong>, the amount on the statement. After you save, it matches this line automatically.
      </div>
      {error && (
        <div role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}
