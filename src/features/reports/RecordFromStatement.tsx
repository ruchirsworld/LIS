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
import { useCreateExpense } from '../../lib/queries/expenses'
import { useCreateVendorBillPayment, useVendorBillPayments, useVendorBills } from '../../lib/queries/purchases'
import { useCreateInvoicePayment, useInvoicePayments, useInvoices } from '../../lib/queries/invoices'

type Kind = 'transfer' | 'expense' | 'vendor' | 'receipt'

const CASH = 'cash'
const KIND_LABEL: Record<Kind, string> = {
  transfer: 'Transfer between my accounts',
  expense: 'Expense (bank charges, site cost ...)',
  vendor: 'Payment to a vendor',
  receipt: 'Receipt from a client',
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
  const kinds: Kind[] = incoming ? ['transfer', 'receipt'] : ['transfer', 'expense', 'vendor']

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
  const createReceipt = useCreateInvoicePayment()

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
  const [invoiceId, setInvoiceId] = useState('')
  const [isRelease, setIsRelease] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherAccounts = [{ id: CASH, name: 'Cash' }, ...(banks ?? []).filter((b) => b.id !== bankAccountId)]

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
        .filter((x) => x.due > 0.01 || x.held > 0.01),
    [invoices, invoicePayments, clientId]
  )

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
        if (!invoiceId) throw new Error('Pick the invoice this payment is for.')
        await createReceipt.mutateAsync({
          invoice_id: invoiceId,
          date,
          amount,
          reference: reference.trim() || null,
          payment_mode: 'Bank',
          bank_account_id: bankAccountId,
          is_retention_release: isRelease,
          gst_component: 0,
        })
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
              This vendor has no unpaid bill. Record the bill first in Procurements (it needs the bill date, the type of cost and the amount), then come back.{' '}
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

      {kind === 'receipt' && (
        <>
          <div className="field">
            <label>Client</label>
            <SearchableSelect
              items={clients}
              value={clientId}
              onChange={(v) => {
                setClientId(v)
                setInvoiceId('')
              }}
              getId={(c) => c.id}
              getLabel={(c) => c.name}
            />
          </div>
          {clientId && openInvoices.length === 0 && <div className="note">This client has no invoice that is due or holding retention. Check that the invoice is marked Sent.</div>}
          {openInvoices.length > 0 && (
            <>
              <div className="field">
                <label htmlFor="rfs-inv">Which invoice is this payment for?</label>
                <select id="rfs-inv" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                  <option value="">Pick an invoice</option>
                  {openInvoices.map(({ inv, due, held }) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number || inv.display_id} · due {fmt2(due)}
                      {held > 0.01 ? ` · retention held ${fmt2(held)}` : ''}
                    </option>
                  ))}
                </select>
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
      {(kind === 'transfer' || kind === 'expense') && (
        <div className="field">
          <label htmlFor="rfs-notes">{kind === 'expense' ? 'Description' : 'Note'}</label>
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
