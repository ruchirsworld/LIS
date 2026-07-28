import { billTotal, type VendorBillRow } from './vendorBills'
import { netPayable, totalPaid, type InvoiceRow, type InvoicePaymentRow } from './invoices'

export interface ExpenseRow {
  project_id: string | null
  amount: number
}

export function projectExpenseTotal(projectId: string, expenses: ExpenseRow[]): number {
  return expenses
    .filter((e) => e.project_id === projectId)
    .reduce((s, e) => s + Number(e.amount || 0), 0)
}

export function projectVendorBillTotal(projectId: string, bills: (VendorBillRow & { project_id: string | null })[]): number {
  return bills
    .filter((b) => b.project_id === projectId)
    .reduce((s, b) => s + billTotal(b), 0)
}

export interface TeamTrackerRow {
  project_id: string
  total: number | null
}

export function projectManPowerTotal(projectId: string, entries: TeamTrackerRow[]): number {
  return entries.filter((e) => e.project_id === projectId).reduce((s, e) => s + Number(e.total || 0), 0)
}

export function projectInvoicedRevenue(
  projectId: string,
  invoices: (InvoiceRow & { id: string; project_id: string | null })[],
): number {
  return invoices
    .filter((i) => i.project_id === projectId)
    .reduce((s, i) => s + netPayable(i), 0)
}

export function projectReceivedRevenue(
  projectId: string,
  invoices: (InvoiceRow & { id: string; project_id: string | null })[],
  payments: (InvoicePaymentRow & { invoice_id: string })[],
): number {
  return invoices
    .filter((i) => i.project_id === projectId)
    .reduce((s, i) => {
      const invPayments = payments.filter((p) => p.invoice_id === i.id)
      return s + totalPaid(invPayments)
    }, 0)
}
