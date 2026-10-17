import { supabase } from './supabase'
import type { ExpenseCostCenter, TabId } from './nav'
import type { NavFilter } from './navContext'

/** Where to send the user to see or change the record behind a line in the books. */
export interface EntryTarget {
  tab: TabId
  costCenter?: ExpenseCostCenter
  filter?: NavFilter
}

const COST_CENTERS: readonly string[] = ['Admin', 'Trips', 'Project']

/** The screen that holds a record, from the kind of record alone. */
export function baseTarget(sourceTable: string | null | undefined, date: string): EntryTarget | null {
  const day = { range: { from: date, to: date } }
  switch (sourceTable) {
    case 'expenses':
      return { tab: 'expenses', filter: day }
    case 'expense_reimbursements':
      return { tab: 'expenses' }
    case 'transfers':
    case 'other_receipts':
      return { tab: 'transfers' }
    case 'vendor_bills':
    case 'vendor_bill_payments':
    case 'vendor_advances':
      return { tab: 'purchases', filter: day }
    case 'invoices':
    case 'invoice_notes':
      return { tab: 'invoices', filter: { focus: 'inv-ledger' } }
    case 'invoice_payments':
      return { tab: 'receipts', filter: { focus: 'inv-payments' } }
    case 'staff_imprest_transactions':
      return { tab: 'hr', filter: { hrSection: 'Imprest' } }
    case 'wage_accruals':
    case 'wage_payments':
    case 'staff_salary_advances':
      return { tab: 'hr' }
    case 'loans':
    case 'loan_payments':
      return { tab: 'loans' }
    case 'capital_transactions':
      return { tab: 'capital' }
    case 'manual_journal':
      return { tab: 'reports', filter: { report: 'journal-vouchers' } }
    case 'trips':
      return { tab: 'expenses', costCenter: 'Trips' }
    case 'account_openings':
      return { tab: 'reports', filter: { report: 'monthly-balances' } }
    default:
      return null
  }
}

/** Like baseTarget, but looks the record up so the right expense group or client is opened. */
export async function resolveEntryTarget(sourceTable: string | null | undefined, sourceId: string | null | undefined, date: string): Promise<EntryTarget | null> {
  const base = baseTarget(sourceTable, date)
  if (!base || !sourceId) return base
  try {
    if (sourceTable === 'expenses') {
      const { data } = await supabase.from('expenses').select('cost_center').eq('id', sourceId).maybeSingle()
      const cc = data?.cost_center
      return cc && COST_CENTERS.includes(cc) ? { ...base, costCenter: cc as ExpenseCostCenter } : base
    }
    if (sourceTable === 'invoice_payments') {
      const { data } = await supabase.from('invoice_payments').select('invoices(client_id)').eq('id', sourceId).maybeSingle()
      const inv = data?.invoices as { client_id: string } | { client_id: string }[] | null | undefined
      const clientId = Array.isArray(inv) ? inv[0]?.client_id : inv?.client_id
      return clientId ? { ...base, filter: { ...base.filter, clientId } } : base
    }
    if (sourceTable === 'invoices') {
      const { data } = await supabase.from('invoices').select('client_id').eq('id', sourceId).maybeSingle()
      return data?.client_id ? { ...base, filter: { ...base.filter, clientId: data.client_id } } : base
    }
    if (sourceTable === 'invoice_notes') {
      const { data } = await supabase.from('invoice_notes').select('invoices(client_id)').eq('id', sourceId).maybeSingle()
      const inv = data?.invoices as { client_id: string } | { client_id: string }[] | null | undefined
      const clientId = Array.isArray(inv) ? inv[0]?.client_id : inv?.client_id
      return clientId ? { ...base, filter: { ...base.filter, clientId } } : base
    }
  } catch {
    // Fall back to the general screen.
  }
  return base
}
