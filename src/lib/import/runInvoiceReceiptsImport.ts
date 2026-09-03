import { supabase } from '../supabase'
import { clientLabel } from '../labels'
import { dueAmount } from '../calc/invoices'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { SHEET_RECEIPTS, COLUMNS_RECEIPTS } from './invoiceReceiptsSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type InvoicePaymentInsert = Database['public']['Tables']['invoice_payments']['Insert']

/** Reads and validates every row of the uploaded Invoice-receipts sheet —
 * same Client + optional Invoice + Date + Amount shape as
 * InvoiceReceiptForm.tsx, with the same FIFO auto-adjust when Invoice is
 * left blank. Nothing is written here; the caller reviews the result and
 * calls commitInvoiceReceiptsImport with whichever rows parsed cleanly. */
export async function parseInvoiceReceiptsImport(file: File): Promise<ParsedRow<InvoicePaymentInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const rows: ParsedRow<InvoicePaymentInsert>[] = []

  const { data: clients, error: clientErr } = await supabase.from('clients').select('id, name, client_code')
  if (clientErr) throw clientErr
  const clientByLabel = new Map((clients ?? []).map((c) => [clientLabel(c).trim().toLowerCase(), c]))

  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, client_id, amount, gst_pct, tds_pct, due_date_manual, due_days, invoice_date, status, invoice_number, display_id')
  if (invErr) throw invErr
  type InvoiceSelectRow = NonNullable<typeof invoices>[number]

  const { data: existingPayments, error: payErr } = await supabase.from('invoice_payments').select('invoice_id, date, amount')
  if (payErr) throw payErr

  // Running total paid per invoice — seeded from existing payments, then
  // topped up as each row in this file is assigned to an invoice, so a
  // blank "Invoice no." on a later row correctly sees earlier rows' amounts
  // already absorbed by the oldest invoice (same FIFO behavior as the live
  // form, just applied down the sheet instead of one submit at a time).
  const paidByInvoiceId = new Map<string, number>()
  for (const p of existingPayments ?? []) {
    paidByInvoiceId.set(p.invoice_id, (paidByInvoiceId.get(p.invoice_id) ?? 0) + Number(p.amount))
  }

  // Existing receipts to check new rows against — same key as the
  // within-file check below (invoice, date, amount).
  const existingKeys = new Set((existingPayments ?? []).map((p) => `${p.invoice_id}|${p.date}|${Number(p.amount)}`))
  const seenInFile = new Map<string, number>()

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_RECEIPTS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const clientInput = str(row[COLUMNS_RECEIPTS[0]])
      const invoiceInput = str(row[COLUMNS_RECEIPTS[1]])
      const date = toDateStr(row[COLUMNS_RECEIPTS[2]])
      const amount = num(row[COLUMNS_RECEIPTS[3]])

      if (!clientInput) throw new Error('Client is required')
      const client = clientByLabel.get(clientInput.trim().toLowerCase())
      if (!client) throw new Error(`Client "${clientInput}" not found`)

      if (!date) throw new Error('Date is required')
      if (amount === null || amount <= 0) throw new Error('Amount is required')

      const clientInvoices = (invoices ?? []).filter((inv) => inv.client_id === client.id)

      let target: InvoiceSelectRow | undefined
      if (invoiceInput) {
        target = clientInvoices.find(
          (inv) =>
            (inv.invoice_number && inv.invoice_number.trim().toLowerCase() === invoiceInput.trim().toLowerCase()) ||
            (inv.display_id && inv.display_id.trim().toLowerCase() === invoiceInput.trim().toLowerCase())
        )
        if (!target) throw new Error(`Invoice "${invoiceInput}" not found for Client "${clientInput}"`)
      } else {
        target = clientInvoices
          .filter((inv) => dueAmount(inv, [{ amount: paidByInvoiceId.get(inv.id) ?? 0 }]) > 0)
          .sort((a, b) => (a.invoice_date ?? '9999-99-99').localeCompare(b.invoice_date ?? '9999-99-99'))[0]
        if (!target) throw new Error(`Client "${clientInput}" has no outstanding invoices`)
      }

      const dedupeKey = `${target.id}|${date}|${amount}`
      let warning: string | undefined
      if (existingKeys.has(dedupeKey)) {
        warning = 'Matches a receipt already in the system (same invoice, date, amount)'
      } else if (seenInFile.has(dedupeKey)) {
        warning = `Duplicates row ${seenInFile.get(dedupeKey)} in this file`
      }
      seenInFile.set(dedupeKey, rowNum)

      paidByInvoiceId.set(target.id, (paidByInvoiceId.get(target.id) ?? 0) + amount)

      const payload: InvoicePaymentInsert = {
        invoice_id: target.id,
        date,
        amount,
      }
      rows.push({
        row: rowNum,
        status: 'ready',
        warning,
        preview: {
          Client: clientInput,
          Invoice: target.invoice_number ?? target.display_id ?? '—',
          Date: date,
          Amount: fmt(amount),
        },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitInvoiceReceiptsImport(rows: ParsedRow<InvoicePaymentInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('invoice_payments').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_RECEIPTS, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_RECEIPTS, row: r.row, status: 'ok', message: 'Recorded receipt', warning: r.warning }
    )
  }
  return results
}
