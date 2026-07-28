// Ported 1:1 from LIS_v1.0.html (netPayable/gstAmt/tdsAmt/totalPaid/dueAmount/
// effectiveDueDate/isPastDue/effectiveStatus). This is validated business
// logic — the prototype is ground truth for behavior, only the code shape
// (snake_case DB fields, typed) has changed.

export interface InvoiceRow {
  amount: number
  gst_pct: number | null
  tds_pct: number | null
  due_date_manual: string | null
  due_days: number | null
  invoice_date: string | null
  status: 'draft' | 'sent'
}

export interface InvoicePaymentRow {
  amount: number
}

export function gstAmt(inv: InvoiceRow): number {
  return Number(inv.amount || 0) * Number(inv.gst_pct || 0) / 100
}

export function tdsAmt(inv: InvoiceRow): number {
  return Number(inv.amount || 0) * Number(inv.tds_pct || 0) / 100
}

export function netPayable(inv: InvoiceRow): number {
  return Number(inv.amount || 0) + gstAmt(inv) - tdsAmt(inv)
}

export function totalPaid(payments: InvoicePaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

export function dueAmount(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  return Math.max(0, netPayable(inv) - totalPaid(payments))
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().slice(0, 10)
}

export function effectiveDueDate(inv: InvoiceRow): string | null {
  if (inv.due_days && inv.invoice_date) return addDays(inv.invoice_date, inv.due_days)
  return inv.due_date_manual
}

export function isPastDue(inv: InvoiceRow): boolean {
  const due = effectiveDueDate(inv)
  if (!due) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(due) < today
}

export type EffectiveStatus = 'paid' | 'overdue' | 'draft' | 'sent'

export function effectiveStatus(inv: InvoiceRow, payments: InvoicePaymentRow[]): EffectiveStatus {
  const due = dueAmount(inv, payments)
  const net = netPayable(inv)
  if (due <= 0.01 && net > 0) return 'paid'
  if (isPastDue(inv)) return 'overdue'
  return inv.status
}
