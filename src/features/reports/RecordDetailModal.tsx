import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { useProfiles } from '../../lib/queries/admin'
import { useBankAccounts, useClients, useExpenseSubHeads, useProjects, useStaff, useVendors } from '../../lib/queries/masters'

/** The tables a record can be read from. Anything else is opened in its own screen. */
const READABLE = new Set([
  'expenses',
  'expense_reimbursements',
  'vendor_bills',
  'vendor_bill_payments',
  'vendor_advances',
  'invoices',
  'invoice_payments',
  'invoice_notes',
  'transfers',
  'loans',
  'loan_payments',
  'capital_transactions',
  'other_receipts',
  'wage_payments',
  'wage_accruals',
  'staff_imprest_transactions',
  'staff_salary_advances',
  'trips',
  'account_openings',
])
export const canShowRecord = (table: string | null | undefined) => !!table && READABLE.has(table)

/** Never shown: internal ids and fields with a friendlier line of their own. */
const HIDDEN = new Set(['id', 'created_by', 'created_at', 'updated_at', 'geo_lat', 'geo_lng', 'receipt_path', 'source_id', 'receipt_id'])

const LABELS: Record<string, string> = {
  display_id: 'ID',
  sub_head_id: 'Expense head',
  bank_account_id: 'Paid from / into',
  from_account_id: 'From account',
  to_account_id: 'To account',
  paid_by: 'Paid by',
  reimburse_to: 'To be reimbursed to',
  approved_by: 'Approved by',
  partner_id: 'Partner',
  profile_id: 'Supervisor',
  traveler_id: 'Traveler',
  staff_id: 'Staff member',
  gst_pct: 'GST %',
  tds_pct: 'TDS %',
  retention_pct: 'Retention %',
  roi_pct: 'Interest rate %',
  gst_on_hold: 'GST held by the client',
  hsn_sac: 'HSN / SAC',
  due_days: 'Due in (days)',
  due_date_manual: 'Due date',
  as_on: 'Date',
  date_taken: 'Date taken',
  invoice_id: 'Invoice',
  bill_id: 'Vendor bill',
  expense_id: 'Expense',
  loan_id: 'Loan',
  trip_id: 'Trip',
  advance_id: 'Advance used',
  vendor_bill_payment_id: 'Vendor payment',
  qty: 'Quantity',
  gstr3b_period: 'GSTR-3B period',
  gstr3b_filed_on: 'GSTR-3B filed on',
  gstr3b_sent_on: 'GSTR-3B proof sent on',
  is_retention_release: 'Retention release',
  gst_component: 'GST part of the receipt',
  paid_from_imprest: 'Paid from site imprest',
}

const humanise = (key: string) => {
  const s = key.replace(/_id$/, '').replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const isMoney = (key: string) => /amount|principal|interest|^rate$|budget|value_ex_gst|advance_recovered|^additional|other_cost|^principal$/.test(key) && !/pct|roi/.test(key)
const isDate = (key: string, v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && /date|_on$|^as_on$|period_(start|end)|^month$/.test(key)

interface Loaded {
  row: Record<string, unknown>
  refs: Record<string, string>
  items: { name: string; qty: number | null; unit: string | null; rate: number | null; amount: number }[]
}

/** The look-ups for the links a record holds to other records (an invoice, a bill, a trip), by the field that holds them. */
const REF_SOURCES: Record<string, { table: string; select: string; label: (r: Record<string, unknown>) => string }> = {
  invoice_id: { table: 'invoices', select: 'invoice_number, display_id', label: (r) => String(r.invoice_number ?? r.display_id ?? '') },
  bill_id: { table: 'vendor_bills', select: 'display_id, description', label: (r) => [r.display_id, r.description].filter(Boolean).join(' — ') },
  expense_id: { table: 'expenses', select: 'display_id, description', label: (r) => [r.display_id, r.description].filter(Boolean).join(' — ') },
  loan_id: { table: 'loans', select: 'display_id, lender', label: (r) => [r.display_id, r.lender].filter(Boolean).join(' — ') },
  trip_id: { table: 'trips', select: 'display_id, name', label: (r) => [r.display_id, r.name].filter(Boolean).join(' — ') },
  advance_id: { table: 'vendor_advances', select: 'display_id', label: (r) => String(r.display_id ?? '') },
  vendor_bill_payment_id: { table: 'vendor_bill_payments', select: 'display_id', label: (r) => String(r.display_id ?? '') },
}

/** Shows every detail of one record in a popup, so it can be checked without leaving the page. Read only. */
export function RecordDetailModal({
  title,
  sourceTable,
  sourceId,
  recordedBy,
  onClose,
  onOpenScreen,
}: {
  title: string
  sourceTable: string
  sourceId: string
  recordedBy?: string
  onClose: () => void
  onOpenScreen?: () => void
}) {
  const { data: vendors } = useVendors()
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: staff } = useStaff()
  const { data: banks } = useBankAccounts()
  const { data: profiles } = useProfiles()
  const { data: subHeads } = useExpenseSubHeads()

  const { data, isLoading, error } = useQuery({
    queryKey: ['record_detail', sourceTable, sourceId],
    queryFn: async (): Promise<Loaded | null> => {
      const { data: row, error: e } = await supabase.from(sourceTable as 'expenses').select('*').eq('id', sourceId).maybeSingle()
      if (e) throw e
      if (!row) return null
      const record = row as unknown as Record<string, unknown>
      const refs: Record<string, string> = {}
      for (const [key, src] of Object.entries(REF_SOURCES)) {
        const id = record[key]
        if (typeof id !== 'string') continue
        const { data: other } = await supabase.from(src.table as 'invoices').select(src.select).eq('id', id).maybeSingle()
        if (other) refs[key] = src.label(other as unknown as Record<string, unknown>)
      }
      let items: Loaded['items'] = []
      if (sourceTable === 'vendor_bills') {
        const { data: lines } = await supabase.from('vendor_bill_items').select('name, qty, unit, rate, amount').eq('bill_id', sourceId).order('position')
        items = (lines ?? []) as Loaded['items']
      }
      return { row: record, refs, items }
    },
  })

  const nameIn = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((x) => x.id === id)?.name
  const whoIs = (id: unknown) => (typeof id === 'string' ? nameIn(profiles, id) ?? '—' : '—')

  function show(key: string, value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (key in (data?.refs ?? {})) return data?.refs[key] ?? null
    if (typeof value === 'string') {
      switch (key) {
        case 'vendor_id':
          return nameIn(vendors, value) ?? null
        case 'client_id':
          return nameIn(clients, value) ?? null
        case 'project_id':
          return nameIn(projects, value) ?? null
        case 'staff_id':
          return nameIn(staff, value) ?? null
        case 'sub_head_id':
          return nameIn(subHeads, value) ?? null
        case 'bank_account_id':
        case 'from_account_id':
        case 'to_account_id':
          return nameIn(banks, value) ?? null
        case 'paid_by':
        case 'reimburse_to':
        case 'approved_by':
        case 'partner_id':
        case 'profile_id':
        case 'traveler_id':
          return whoIs(value)
      }
      if (isDate(key, value)) return fmtDate(value)
      if (key !== 'display_id' && /_id$/.test(key)) return null // a link we cannot name: not worth showing as a code
      return value
    }
    if (typeof value === 'number') {
      if (isMoney(key)) return fmt2(value)
      if (/pct|roi/.test(key)) return `${value}%`
      return String(value)
    }
    return null
  }

  const row = data?.row
  const entries = row ? Object.entries(row).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => ({ key: k, label: LABELS[k] ?? humanise(k), text: show(k, v) })).filter((x) => x.text !== null) : []
  // A card with a leading ID line reads best, then the rest in the order the record holds them.
  entries.sort((a, b) => (a.key === 'display_id' ? -1 : b.key === 'display_id' ? 1 : 0))
  const createdAt = typeof row?.created_at === 'string' ? new Date(row.created_at as string) : null

  return (
    <Modal title={title} onClose={onClose}>
      {isLoading && <div className="note">Loading…</div>}
      {!isLoading && (error || !row) && <div className="note" style={{ color: 'var(--red)' }}>Could not load this record. It may have been deleted.</div>}
      {row && (
        <>
          <div>
            <table className="data" style={{ width: '100%', tableLayout: 'fixed' }}>
              <tbody>
                {entries.map((x) => (
                  <tr key={x.key}>
                    <th style={{ width: '38%', textAlign: 'left', fontWeight: 600 }}>{x.label}</th>
                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{x.text}</td>
                  </tr>
                ))}
                <tr>
                  <th style={{ textAlign: 'left', fontWeight: 600 }}>Recorded by</th>
                  <td>{recordedBy ?? whoIs(row.created_by)}</td>
                </tr>
                {createdAt && (
                  <tr>
                    <th style={{ textAlign: 'left', fontWeight: 600 }}>Recorded on</th>
                    <td>
                      {fmtDate(createdAt.toISOString().slice(0, 10))}, {createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )}
                {typeof row.receipt_path === 'string' && row.receipt_path && (
                  <tr>
                    <th style={{ textAlign: 'left', fontWeight: 600 }}>Receipt</th>
                    <td style={{ whiteSpace: 'normal' }}>Attached. Open its screen to view it.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.items.length > 0 && (
            <>
              <div className="note" style={{ fontWeight: 600, marginTop: 12 }}>
                Items on this bill
              </div>
              <div>
                <table className="data" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it, i) => (
                      <tr key={i}>
                        <td>{it.name}</td>
                        <td className="amt">{it.qty ?? ''} {it.unit ?? ''}</td>
                        <td className="amt">{it.rate === null ? '' : fmt2(it.rate)}</td>
                        <td className="amt">{fmt2(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {onOpenScreen && (
          <Button type="button" variant="secondary" onClick={onOpenScreen}>
            Open it in its screen to change it
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
