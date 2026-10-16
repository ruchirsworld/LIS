import { selectByIds } from './byIds'
import { otherReceiptLabel } from '../calc/otherReceipts'

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
    type Named = { id: string; name: string }
    const ids = (table: string) => idsOf(rows, table)

    // Round 1: the records the lines point at, all at once.
    const [reimbRows, expenseRows, paymentRows, advanceRows, receiptRows, transferRows, capitalRows, loanRows, loanPayRows, otherRows, imprestRows, wageRows, salaryAdvRows] = await Promise.all([
      selectByIds<{ id: string; reference: string | null; expense_id: string | null }>('expense_reimbursements', 'id, reference, expense_id', 'id', ids('expense_reimbursements')),
      selectByIds<{ id: string; description: string | null; remarks: string | null; display_id: string | null; created_by: string | null }>('expenses', 'id, description, remarks, display_id, created_by', 'id', ids('expenses')),
      selectByIds<{ id: string; reference: string | null; bill_id: string }>('vendor_bill_payments', 'id, reference, bill_id', 'id', ids('vendor_bill_payments')),
      selectByIds<{ id: string; notes: string | null; reference: string | null; vendor_id: string }>('vendor_advances', 'id, notes, reference, vendor_id', 'id', ids('vendor_advances')),
      selectByIds<{ id: string; reference: string | null; invoice_id: string }>('invoice_payments', 'id, reference, invoice_id', 'id', ids('invoice_payments')),
      selectByIds<{ id: string; notes: string | null }>('transfers', 'id, notes', 'id', ids('transfers')),
      selectByIds<{ id: string; notes: string | null; partner_id: string }>('capital_transactions', 'id, notes, partner_id', 'id', ids('capital_transactions')),
      selectByIds<{ id: string; lender: string | null; notes: string | null }>('loans', 'id, lender, notes', 'id', ids('loans')),
      selectByIds<{ id: string; reference: string | null; loan_id: string }>('loan_payments', 'id, reference, loan_id', 'id', ids('loan_payments')),
      selectByIds<{ id: string; kind: string; payer: string | null; notes: string | null; reference: string | null }>('other_receipts', 'id, kind, payer, notes, reference', 'id', ids('other_receipts')),
      selectByIds<{ id: string; remarks: string | null }>('staff_imprest_transactions', 'id, remarks', 'id', ids('staff_imprest_transactions')),
      selectByIds<{ id: string; notes: string | null }>('wage_payments', 'id, notes', 'id', ids('wage_payments')),
      selectByIds<{ id: string; remarks: string | null }>('staff_salary_advances', 'id, remarks', 'id', ids('staff_salary_advances')),
    ])
    const reimb = byId(reimbRows)
    const payments = byId(paymentRows)
    const advances = byId(advanceRows)
    const receipts = byId(receiptRows)
    const transfers = byId(transferRows)
    const capital = byId(capitalRows)
    const loans = byId(loanRows)
    const loanPays = byId(loanPayRows)
    const otherReceipts = byId(otherRows)
    const imprest = byId(imprestRows)
    const wages = byId(wageRows)
    const salaryAdv = byId(salaryAdvRows)

    // Round 2: what those records point at (the expense behind a reimbursement, the bill behind a payment ...).
    const reimbExpenseIds = reimbRows.map((r) => r.expense_id).filter((x): x is string => !!x && !expenseRows.some((e) => e.id === x))
    const [moreExpenses, billRows, invoiceRows, loanOfPayRows] = await Promise.all([
      selectByIds<(typeof expenseRows)[number]>('expenses', 'id, description, remarks, display_id, created_by', 'id', reimbExpenseIds),
      selectByIds<{ id: string; description: string | null; display_id: string | null; vendor_id: string }>('vendor_bills', 'id, description, display_id, vendor_id', 'id', paymentRows.map((p) => p.bill_id)),
      selectByIds<{ id: string; invoice_number: string | null; display_id: string | null; client_id: string }>('invoices', 'id, invoice_number, display_id, client_id', 'id', receiptRows.map((r) => r.invoice_id)),
      selectByIds<{ id: string; lender: string | null }>('loans', 'id, lender', 'id', loanPayRows.map((p) => p.loan_id)),
    ])
    const expenses = byId([...expenseRows, ...moreExpenses])
    const bills = byId(billRows)
    const invoices = byId(invoiceRows)
    const loanOfPay = byId(loanOfPayRows)

    // Round 3: names.
    const peopleIds = [...expenses.values()].map((e) => e.created_by).filter((x): x is string => !!x).concat(capitalRows.map((c) => c.partner_id))
    const [vendorRows, clientRows, peopleRows] = await Promise.all([
      selectByIds<Named>('vendors', 'id, name', 'id', [...billRows, ...advanceRows].map((x) => x.vendor_id)),
      selectByIds<Named>('clients', 'id, name', 'id', invoiceRows.map((i) => i.client_id)),
      selectByIds<Named>('profiles', 'id, name', 'id', peopleIds),
    ])
    const vendors = byId(vendorRows)
    const clients = byId(clientRows)
    const people = byId(peopleRows)

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
        case 'other_receipts': {
          const o = otherReceipts.get(id)
          if (o) set('other_receipts', id, join([otherReceiptLabel(o.kind), o.payer, o.notes, o.reference]))
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
