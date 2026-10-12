// Ported 1:1 from LIS_v1.0.html (netPayable/gstAmt/tdsAmt/totalPaid/dueAmount/
// effectiveDueDate/isPastDue/effectiveStatus). This is validated business
// logic — the prototype is ground truth for behavior, only the code shape
// (snake_case DB fields, typed) has changed.

export interface InvoiceRow {
  amount: number
  gst_pct: number | null
  tds_pct: number | null
  retention_pct?: number | null
  retention_release_date?: string | null
  /** The client releases this invoice's GST only after proof of deposit (GSTR-3B). */
  gst_on_hold?: boolean | null
  // Totals of the invoice's credit (−) and debit (+) notes, attached by useInvoices.
  adj_amount?: number | null
  adj_gst?: number | null
  adj_tds?: number | null
  adj_retention?: number | null
  due_date_manual: string | null
  due_days: number | null
  invoice_date: string | null
  status: 'draft' | 'sent'
}

export interface InvoicePaymentRow {
  amount: number
  /** True for a payment recorded as the client releasing held retention. */
  is_retention_release?: boolean | null
  /** How much of this payment was the client releasing GST (on a GST-held invoice). */
  gst_component?: number | null
}

// Every tax figure is held to the paisa, exactly as it is posted to the
// ledger — otherwise a client's balance drifts from the books by a few paise.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function gstAmt(inv: InvoiceRow): number {
  return round2(Number(inv.amount || 0) * Number(inv.gst_pct || 0) / 100) + Number(inv.adj_gst || 0)
}

export function tdsAmt(inv: InvoiceRow): number {
  return round2(Number(inv.amount || 0) * Number(inv.tds_pct || 0) / 100) + Number(inv.adj_tds || 0)
}

export function netPayable(inv: InvoiceRow): number {
  return Number(inv.amount || 0) + Number(inv.adj_amount || 0) + gstAmt(inv) - tdsAmt(inv)
}

// Same as netPayable but leaving GST out — GST is collected on the
// government's behalf, never real revenue, so a few displays (Project
// Invoiced/Due) show this instead of the GST-inclusive figure.
export function netPayableExGst(inv: InvoiceRow): number {
  return Number(inv.amount || 0) + Number(inv.adj_amount || 0) - tdsAmt(inv)
}

// The % of net_payable a client contractually holds back for a period —
// still owed, but not collectible (or overdue) until released. Doesn't
// reduce GST liability, which is charged on the full invoice value.
export function retentionAmt(inv: InvoiceRow): number {
  // Retention on the invoice as issued, plus retention on its notes.
  const asIssued =
    Number(inv.amount || 0) +
    round2(Number(inv.amount || 0) * Number(inv.gst_pct || 0) / 100) -
    round2(Number(inv.amount || 0) * Number(inv.tds_pct || 0) / 100)
  return round2(asIssued * Number(inv.retention_pct || 0) / 100) + Number(inv.adj_retention || 0)
}

export function totalPaid(payments: InvoicePaymentRow[]): number {
  return payments.reduce((s, p) => s + Number(p.amount || 0), 0)
}

// Money received against the retention itself — only payments explicitly
// recorded as a retention release count; retention is never assumed released
// just because payments ran ahead of the collectible part.
export function releasedPaid(payments: InvoicePaymentRow[]): number {
  return totalPaid(payments.filter((p) => p.is_retention_release))
}

function regularPaid(payments: InvoicePaymentRow[]): number {
  return totalPaid(payments) - releasedPaid(payments)
}

// GST the client has released so far, for a client that holds it back until
// proof of deposit; always 0 on an invoice that is not on that footing.
export function gstReleased(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  if (!inv.gst_on_hold) return 0
  return payments.filter((p) => !p.is_retention_release).reduce((s, p) => s + Number(p.gst_component || 0), 0)
}

// GST still held back: owed by the client, but not collectible (or overdue)
// until they release it. Like retention it stays out of Due.
export function gstHeld(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  if (!inv.gst_on_hold) return 0
  const held = gstAmt(inv) - gstReleased(inv, payments)
  return held > 0.01 ? held : 0
}

export function dueAmount(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  return Math.max(0, netPayable(inv) - retentionAmt(inv) - regularPaid(payments) - gstHeld(inv, payments))
}

// What the client has paid beyond what the invoice can take: ordinary
// payments past the collectible part (net payable less retention), plus any
// retention-release payments past the retention. dueAmount floors at 0, so
// this is where an excess shows up.
export function extraPaid(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  // On a GST-held invoice the collectible part excludes the GST, which is
  // measured separately against what the client has released.
  const onHold = !!inv.gst_on_hold
  const released = gstReleased(inv, payments)
  const collectible = netPayable(inv) - retentionAmt(inv) - (onHold ? gstAmt(inv) : 0)
  const paidThatSide = regularPaid(payments) - released
  const extra =
    Math.max(0, paidThatSide - collectible) +
    (onHold ? Math.max(0, released - gstAmt(inv)) : 0) +
    Math.max(0, releasedPaid(payments) - retentionAmt(inv))
  return extra > 0.01 ? extra : 0
}

// Retention still held back: the retention less what has been recorded as
// released.
export function retentionHeld(inv: InvoiceRow, payments: InvoicePaymentRow[]): number {
  const held = retentionAmt(inv) - releasedPaid(payments)
  return held > 0.01 ? held : 0
}

// True once the retention release date has arrived and some is still held.
export function isRetentionReleaseDue(inv: InvoiceRow, payments: InvoicePaymentRow[]): boolean {
  if (!inv.retention_release_date) return false
  return retentionHeld(inv, payments) > 0 && inv.retention_release_date <= new Date().toISOString().slice(0, 10)
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
  const net = netPayable(inv)
  // "Paid" means fully settled — the collectible part received, any
  // retention released and any held GST released — not just the
  // currently-collectible portion.
  if (net > 0 && dueAmount(inv, payments) <= 0.01 && retentionHeld(inv, payments) <= 0 && gstHeld(inv, payments) <= 0) return 'paid'
  if (isPastDue(inv) && dueAmount(inv, payments) > 0.01) return 'overdue'
  return inv.status
}
