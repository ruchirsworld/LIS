import { parseInvoicesImport, commitInvoicesImport } from './runInvoicesImport'
import { parseInvoiceReceiptsImport, commitInvoiceReceiptsImport } from './runInvoiceReceiptsImport'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
type InvoicePaymentInsert = Database['public']['Tables']['invoice_payments']['Insert']

type CombinedInsert = { kind: 'invoice'; data: InvoiceInsert } | { kind: 'receipt'; data: InvoicePaymentInsert }

/** Reads both the Invoices and Receipts sheets out of the same workbook —
 * each sheet is parsed by its own standalone importer (unchanged), then
 * tagged with which one it came from and merged into a single review list.
 * A "Type" column up front tells the two apart in the shared table. */
export async function parseInvoicesAndReceiptsImport(file: File): Promise<ParsedRow<CombinedInsert>[]> {
  const [invoiceRows, receiptRows] = await Promise.all([parseInvoicesImport(file), parseInvoiceReceiptsImport(file)])

  const taggedInvoices: ParsedRow<CombinedInsert>[] = invoiceRows.map((r) => ({
    ...r,
    preview: { Type: 'Invoice', ...r.preview },
    payload: r.payload ? { kind: 'invoice', data: r.payload } : undefined,
  }))
  const taggedReceipts: ParsedRow<CombinedInsert>[] = receiptRows.map((r) => ({
    ...r,
    preview: { Type: 'Receipt', ...r.preview },
    payload: r.payload ? { kind: 'receipt', data: r.payload } : undefined,
  }))

  return [...taggedInvoices, ...taggedReceipts]
}

/** Splits the confirmed rows back apart by kind and commits each through
 * its own standalone importer, then merges the results back into one list. */
export async function commitInvoicesAndReceiptsImport(rows: ParsedRow<CombinedInsert>[]): Promise<ImportResultRow[]> {
  const invoiceRows: ParsedRow<InvoiceInsert>[] = rows
    .filter((r): r is ParsedRow<CombinedInsert> & { payload: { kind: 'invoice'; data: InvoiceInsert } } => r.payload?.kind === 'invoice')
    .map((r) => ({ ...r, payload: r.payload.data }))
  const receiptRows: ParsedRow<InvoicePaymentInsert>[] = rows
    .filter((r): r is ParsedRow<CombinedInsert> & { payload: { kind: 'receipt'; data: InvoicePaymentInsert } } => r.payload?.kind === 'receipt')
    .map((r) => ({ ...r, payload: r.payload.data }))

  const [invoiceResults, receiptResults] = await Promise.all([
    invoiceRows.length ? commitInvoicesImport(invoiceRows) : Promise.resolve([]),
    receiptRows.length ? commitInvoiceReceiptsImport(receiptRows) : Promise.resolve([]),
  ])

  return [...invoiceResults, ...receiptResults]
}
