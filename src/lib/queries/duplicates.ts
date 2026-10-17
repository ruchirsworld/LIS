import { supabase } from '../supabase'
import { duplicateWindow, type DuplicateMatch } from '../saveChecks'

// Every place money is recorded, with the columns that say who is behind an entry. Only reads: this never changes a record.
interface Source {
  module: string
  table: string
  /** Columns that hold a person: who entered it, on whose behalf, or who is to be reimbursed. */
  people: string[]
  dateColumn?: string
}

const SOURCES: Source[] = [
  { module: 'Expenses', table: 'expenses', people: ['created_by', 'reimburse_to'] },
  { module: 'Vendor payments', table: 'vendor_bill_payments', people: ['created_by', 'paid_by'] },
  { module: 'Vendor advances', table: 'vendor_advances', people: ['created_by'] },
  { module: 'Transfers', table: 'transfers', people: ['created_by'] },
  { module: 'Capital', table: 'capital_transactions', people: ['created_by'] },
  { module: 'Payments received', table: 'invoice_payments', people: ['created_by'] },
  { module: 'Other receipts', table: 'other_receipts', people: ['created_by'] },
  { module: 'Wage payments', table: 'wage_payments', people: ['created_by'] },
  { module: 'Salary advances', table: 'staff_salary_advances', people: ['created_by'] },
  { module: 'Imprest', table: 'staff_imprest_transactions', people: ['created_by', 'profile_id'] },
]

interface Found {
  display_id: string | null
  date: string
  amount: number
  created_by: string | null
}

/** Entries in any module with the same amount, within two days of this date, and linked to the same person. Never throws: if a search
 * fails the person is simply not warned about that module. */
export async function findPossibleDuplicates(input: { amount: number; date: string; personIds: string[]; ignoreId?: string }): Promise<DuplicateMatch[]> {
  const people = input.personIds.filter(Boolean)
  if (!(input.amount > 0) || people.length === 0) return []
  const { from, to } = duplicateWindow(input.date)

  const found = await Promise.all(
    SOURCES.map(async (s): Promise<DuplicateMatch[]> => {
      try {
        const personFilter = s.people.flatMap((col) => people.map((id) => `${col}.eq.${id}`)).join(',')
        // The tables differ in their columns, so the typed client is bypassed for this read-only search.
        const query = (supabase.from(s.table as 'expenses') as unknown as {
          select: (cols: string) => {
            eq: (c: string, v: number) => { gte: (c: string, v: string) => { lte: (c: string, v: string) => { or: (f: string) => Promise<{ data: Found[] | null; error: unknown }> } } }
          }
        }).select('id, display_id, date, amount, created_by')
        const { data, error } = await query.eq('amount', input.amount).gte('date', from).lte('date', to).or(personFilter)
        if (error || !data) return []
        return data
          .filter((r) => (r as Found & { id?: string }).id !== input.ignoreId)
          .map((r) => ({ module: s.module, displayId: r.display_id, date: r.date, amount: Number(r.amount), enteredBy: r.created_by }))
      } catch {
        return []
      }
    })
  )
  return found.flat().sort((a, b) => b.date.localeCompare(a.date))
}

/** Amounts of earlier entries under one sub-head, for the "unusually large" check. Empty when the search fails. */
export async function earlierAmountsForSubHead(subHeadId: string): Promise<number[]> {
  try {
    const { data, error } = await supabase.from('expenses').select('amount').eq('sub_head_id', subHeadId).order('date', { ascending: false }).limit(200)
    if (error || !data) return []
    return data.map((r) => Number(r.amount))
  } catch {
    return []
  }
}
