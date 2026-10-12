import { describe, expect, it } from 'vitest'
import {
  dueAmount,
  extraPaid,
  gstAmt,
  gstHeld,
  netPayable,
  retentionAmt,
  retentionHeld,
  round2,
  tdsAmt,
  type InvoiceRow,
  type InvoicePaymentRow,
} from './invoices'

const invoice = (over: Partial<InvoiceRow> = {}): InvoiceRow => ({
  amount: 100000,
  gst_pct: 18,
  tds_pct: 2,
  retention_pct: 0,
  due_date_manual: null,
  due_days: 30,
  invoice_date: '2026-06-01',
  status: 'sent',
  ...over,
})

describe('tax maths is held to the paisa', () => {
  it('rounds half-paise the way the ledger does', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('works out GST, TDS and the net payable', () => {
    const inv = invoice()
    expect(gstAmt(inv)).toBe(18000)
    expect(tdsAmt(inv)).toBe(2000)
    expect(netPayable(inv)).toBe(116000)
  })

  it('applies credit and debit notes', () => {
    const inv = invoice({ adj_amount: -10000, adj_gst: -1800, adj_tds: -200 })
    expect(gstAmt(inv)).toBe(16200)
    expect(tdsAmt(inv)).toBe(1800)
    expect(netPayable(inv)).toBe(104400)
  })
})

describe('retention', () => {
  it('is a share of the net payable, kept out of what is due', () => {
    const inv = invoice({ retention_pct: 10 })
    expect(retentionAmt(inv)).toBe(11600)
    expect(dueAmount(inv, [])).toBe(104400)
  })

  it('stays held until a release payment is recorded', () => {
    const inv = invoice({ retention_pct: 10 })
    const pay: InvoicePaymentRow[] = [{ amount: 104400 }]
    expect(dueAmount(inv, pay)).toBe(0)
    expect(retentionHeld(inv, pay)).toBe(11600)
    const released: InvoicePaymentRow[] = [...pay, { amount: 11600, is_retention_release: true }]
    expect(retentionHeld(inv, released)).toBe(0)
  })
})

describe('due and overpayment', () => {
  it('never shows a negative due, and reports the excess instead', () => {
    const inv = invoice()
    const pay: InvoicePaymentRow[] = [{ amount: 120000 }]
    expect(dueAmount(inv, pay)).toBe(0)
    expect(extraPaid(inv, pay)).toBe(4000)
  })

  it('reports no excess when the invoice is paid exactly', () => {
    expect(extraPaid(invoice(), [{ amount: 116000 }])).toBe(0)
  })
})

describe('GST held until the client sees proof of deposit', () => {
  it('keeps held GST out of what is due', () => {
    const inv = invoice({ gst_on_hold: true })
    expect(gstHeld(inv, [])).toBe(18000)
    expect(dueAmount(inv, [])).toBe(98000)
  })

  it('releases GST as payments carry a GST part', () => {
    const inv = invoice({ gst_on_hold: true })
    const pay: InvoicePaymentRow[] = [{ amount: 98000 }, { amount: 18000, gst_component: 18000 }]
    expect(gstHeld(inv, pay)).toBe(0)
    expect(dueAmount(inv, pay)).toBe(0)
  })
})
