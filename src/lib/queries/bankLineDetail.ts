import { selectByIds } from './byIds'

// The label on a ledger line is written by the system ("Vendor payment — Pay/12"). What the person typed when
// they made the entry (the description, the vendor, the note, the reference) lives on the original record. This
// reads those, so Bank reconciliation can show what the entry really is.

interface Source {
  sourceTable: string | null
  sourceId: string | null
}

const join = (parts: (string | null | undefined)[]) =>
  parts
    .map((p) => (p ?? '').toString().trim())
    .filter(Boolean)
    .join(' · ')

const idsOf = (rows: Source[], table: string) => rows.filter((r) => r.sourceTable === table && r.sourceId).map((r) => r.sourceId as string)
const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))

/** What the user typed for each source record, keyed by `table|id`. Never throws: a failed lookup just means no extra detail. */
export async function fetchSourceDetails(rows: Source[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const set = (table: string, id: string, text: string) => {
    if (text) out.set(`${table}|${id}`, text)
  }
  try {
    // Expenses, and the expenses behind reimbursements.
    const reimb = byId(await selectByIds<{ id: string; reference: string | null; expense_id: string | null }>('expense_reimbursements', 'id, reference, expense_id', 'id', idsOf(rows, 'expense_reimbursements')))
    const expenseIds = [...idsOf(rows, 'expenses'), ...[...reimb.values()].map((r) => r.expense_id).filter((x): x is string => !!x)]
    const expenses = byId(await selectByIds<{ id: string; description: string | null; remarks: string | null; display_id: string | null; created_by: string | null }>('expenses', 'id, description, remarks, display_id, created_by', 'id', expenseIds))

    // Vendor payments, with their bill and vendor; advances with their vendor.
    const payments = byId(await selectByIds<{ id: string; reference: string | null; bill_id: string }>('vendor_bill_payments', 'id, reference, bill_id', 'id', idsOf(rows, 'vendor_bill_payments')))
    const bills = byId(await selectByIds<{ id: string; description: string | null; display_id: string | null; vendor_id: string }>('vendor_bills', 'id, description, display_id, vendor_id', 'id', [...payments.values()].map((p) => p.bill_id)))
    const advances = byId(await selectByIds<{ id: string; notes: string | null; reference: string | null; vendor_id: string }>('vendor_advances', 'id, notes, reference, vendor_id', 'id', idsOf(rows, 'vendor_advances')))

    // Client receipts, with the invoice and client.
    const receipts = byId(await selectByIds<{ id: string; reference: string | null; invoice_id: string }>('invoice_payments', 'id, reference, invoice_id', 'id', idsOf(rows, 'invoice_payments')))
    const invoices = byId(await selectByIds<{ id: string; invoice_number: string | null; display_id: string | null; client_id: string }>('invoices', 'id, invoice_number, display_id, client_id', 'id', [...receipts.values()].map((r) => r.invoice_id)))

    // The rest.
    const transfers = byId(await selectByIds<{ id: string; notes: string | null }>('transfers', 'id, notes', 'id', idsOf(rows, 'transfers')))
    const capital = byId(await selectByIds<{ id: string; notes: string | null; partner_id: string }>('capital_transactions', 'id, notes, partner_id', 'id', idsOf(rows, 'capital_transactions')))
    const loans = byId(await selectByIds<{ id: string; lender: string | null; notes: string | null }>('loans', 'id, lender, notes', 'id', idsOf(rows, 'loans')))
    const loanPays = byId(await selectByIds<{ id: string; reference: string | null; loan_id: string }>('loan_payments', 'id, reference, loan_id', 'id', idsOf(rows, 'loan_payments')))
    const loanOfPay = byId(await selectByIds<{ id: string; lender: string | null }>('loans', 'id, lender', 'id', [...loanPays.values()].map((p) => p.loan_id)))
    const imprest = byId(await selectByIds<{ id: string; remarks: string | null }>('staff_imprest_transactions', 'id, remarks', 'id', idsOf(rows, 'staff_imprest_transactions')))
    const wages = byId(await selectByIds<{ id: string; notes: string | null }>('wage_payments', 'id, notes', 'id', idsOf(rows, 'wage_payments')))
    const salaryAdv = byId(await selectByIds<{ id: string; remarks: string | null }>('staff_salary_advances', 'id, remarks', 'id', idsOf(rows, 'staff_salary_advances')))

    // Names: vendors, clients and people.
    const vendorIds = [...bills.values(), ...advances.values()].map((x) => x.vendor_id)
    const vendors = byId(await selectByIds<{ id: string; name: string }>('vendors', 'id, name', 'id', vendorIds))
    const clients = byId(await selectByIds<{ id: string; name: string }>('clients', 'id, name', 'id', [...invoices.values()].map((i) => i.client_id)))
    const peopleIds = [...expenses.values()].map((e) => e.created_by).filter((x): x is string => !!x).concat([...capital.values()].map((c) => c.partner_id))
    const people = byId(await selectByIds<{ id: string; name: string }>('profiles', 'id, name', 'id', peopleIds))

    for (const r of rows) {
      if (!r.sourceTable || !r.sourceId) continue
      const id = r.sourceId
      switch (r.sourceTable) {
        case 'expenses': {
          const e = expenses.get(id)
          if (e) set('expenses', id, join([e.description, e.remarks]))
          break
        }
        case 'expense_reimbursements': {
          const p = reimb.get(id)
          const e = p?.expense_id ? expenses.get(p.expense_id) : undefined
          if (p) set('expense_reimbursements', id, join([e?.created_by ? `To ${people.get(e.created_by)?.name ?? ''}`.trim() : null, e ? `for ${e.description ?? ''} (${e.display_id ?? ''})`.replace(' ()', '') : null, p.reference]))
          break
        }
        case 'vendor_bill_payments': {
          const p = payments.get(id)
          const b = p ? bills.get(p.bill_id) : undefined
          if (p) set('vendor_bill_payments', id, join([b ? vendors.get(b.vendor_id)?.name : null, b ? [b.display_id, b.description].filter(Boolean).join(': ') : null, p.reference]))
          break
        }
        case 'vendor_advances': {
          const a = advances.get(id)
          if (a) set('vendor_advances', id, join([vendors.get(a.vendor_id)?.name, a.notes, a.reference]))
          break
        }
        case 'invoice_payments': {
          const p = receipts.get(id)
          const inv = p ? invoices.get(p.invoice_id) : undefined
          if (p) set('invoice_payments', id, join([inv ? clients.get(inv.client_id)?.name : null, inv ? `Invoice ${inv.invoice_number || inv.display_id || ''}`.trim() : null, p.reference]))
          break
        }
        case 'transfers':
          set('transfers', id, join([transfers.get(id)?.notes]))
          break
        case 'capital_transactions': {
          const c = capital.get(id)
          if (c) set('capital_transactions', id, join([people.get(c.partner_id)?.name, c.notes]))
          break
        }
        case 'loans': {
          const l = loans.get(id)
          if (l) set('loans', id, join([l.lender, l.notes]))
          break
        }
        case 'loan_payments': {
          const p = loanPays.get(id)
          if (p) set('loan_payments', id, join([loanOfPay.get(p.loan_id)?.lender, p.reference]))
          break
        }
        case 'staff_imprest_transactions':
          set('staff_imprest_transactions', id, join([imprest.get(id)?.remarks]))
          break
        case 'wage_payments':
          set('wage_payments', id, join([wages.get(id)?.notes]))
          break
        case 'staff_salary_advances':
          set('staff_salary_advances', id, join([salaryAdv.get(id)?.remarks]))
          break
      }
    }
  } catch {
    // The extra detail is a convenience; the reconciliation works without it.
  }
  return out
}
