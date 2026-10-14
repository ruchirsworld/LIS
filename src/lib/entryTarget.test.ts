import { describe, expect, it, vi } from 'vitest'

// The lookup part talks to the database; only the plain mapping is tested here.
vi.mock('./supabase', () => ({ supabase: {} }))

import { baseTarget } from './entryTarget'

describe('where a line in the books is opened', () => {
  it('sends each kind of record to its own screen', () => {
    expect(baseTarget('transfers', '2026-10-08')?.tab).toBe('transfers')
    expect(baseTarget('loans', '2026-10-08')?.tab).toBe('loans')
    expect(baseTarget('loan_payments', '2026-10-08')?.tab).toBe('loans')
    expect(baseTarget('capital_transactions', '2026-10-08')?.tab).toBe('capital')
    expect(baseTarget('staff_imprest_transactions', '2026-10-08')).toEqual({ tab: 'hr', filter: { hrSection: 'Imprest' } })
    expect(baseTarget('wage_payments', '2026-10-08')?.tab).toBe('hr')
    expect(baseTarget('manual_journal', '2026-10-08')).toEqual({ tab: 'reports', filter: { report: 'journal-vouchers' } })
  })

  it('narrows lists that have a date filter to the day of the entry', () => {
    expect(baseTarget('expenses', '2026-10-08')).toEqual({ tab: 'expenses', filter: { range: { from: '2026-10-08', to: '2026-10-08' } } })
    expect(baseTarget('vendor_bill_payments', '2026-10-09')?.filter?.range).toEqual({ from: '2026-10-09', to: '2026-10-09' })
  })

  it('opens the invoice ledger for anything to do with an invoice', () => {
    for (const t of ['invoices', 'invoice_payments', 'invoice_notes']) expect(baseTarget(t, '2026-10-08')?.tab).toBe('invoices')
  })

  it('returns nothing for a record it does not know', () => {
    expect(baseTarget(null, '2026-10-08')).toBeNull()
    expect(baseTarget('something_else', '2026-10-08')).toBeNull()
  })
})
