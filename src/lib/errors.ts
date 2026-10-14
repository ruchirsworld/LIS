/** Extracts a human-readable message from a caught value of unknown shape.
 * `instanceof Error` alone isn't enough — Supabase/Postgrest/Storage errors
 * are usually real Error instances, but anything thrown from elsewhere
 * (a rejected native promise, a plain object, a string) can slip through
 * and previously fell back to a generic, unhelpful message. This checks
 * Error first, then duck-types for a `.message`/`.details` string, then a
 * plain string, before giving up. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return plainEnglish(rawMessage(err) ?? fallback)
}

function rawMessage(err: unknown): string | null {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    if (typeof record.message === 'string' && record.message) return record.message
    if (typeof record.details === 'string' && record.details) return record.details
  }
  if (typeof err === 'string' && err) return err
  return null
}

// Database errors say things like 'violates foreign key constraint "expenses_trip_id_fkey"'.
// Turn the common ones into a sentence a person can act on; anything else passes through.
const FRIENDLY_TABLES: Record<string, string> = {
  expenses: 'expenses',
  trips: 'trips',
  invoices: 'invoices',
  invoice_payments: 'payments',
  invoice_notes: 'credit or debit notes',
  vendor_bills: 'supplier bills',
  vendor_bill_payments: 'supplier payments',
  projects: 'projects',
  clients: 'clients',
  vendors: 'vendors',
  staff: 'staff records',
  loans: 'loans',
  loan_payments: 'loan repayments',
  staff_attendance: 'attendance entries',
  staff_imprest_transactions: 'imprest entries',
  wage_accruals: 'wage entries',
  wage_payments: 'wage payments',
  bank_accounts: 'bank accounts',
  journal_lines: 'ledger entries',
}

function plainEnglish(message: string): string {
  const fk = message.match(/violates foreign key constraint "[^"]+" on table "([^"]+)"/)
  if (fk && /update or delete on table/.test(message)) {
    const used = FRIENDLY_TABLES[fk[1]] ?? 'other records'
    return `This cannot be deleted because ${used} are still linked to it. Remove or move those first.`
  }
  if (/row-level security|permission denied/i.test(message)) return 'You do not have permission to do that.'
  if (/duplicate key value violates unique constraint/.test(message)) return 'That already exists. Check the list before adding it again.'
  return message
}
