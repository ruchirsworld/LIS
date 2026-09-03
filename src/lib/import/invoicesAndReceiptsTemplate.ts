import { supabase } from '../supabase'
import { clientLabel } from '../labels'
import { SHEET_INVOICES, COLUMNS_INVOICES, INVOICE_STATUSES, EXAMPLE_ROW_INVOICES, INVOICES_INSTRUCTIONS_LINES } from './invoicesSheet'
import { SHEET_RECEIPTS, COLUMNS_RECEIPTS, EXAMPLE_ROW_RECEIPTS, RECEIPTS_INSTRUCTIONS_LINES } from './invoiceReceiptsSheet'

const SHEET_INSTRUCTIONS = 'Instructions'
const SHEET_LISTS = 'Lists'
const DATA_ROWS = 500

/** Builds and downloads one combined bulk-import template covering both
 * Invoices and Receipts — two sheets in the same workbook, sharing one
 * Clients dropdown. Fill in whichever sheet(s) apply; leave the other with
 * just its sample row (or delete that row) to skip it. A Receipts row can
 * only be matched against an invoice that already exists in the system —
 * not one defined in this same file's Invoices sheet — so a brand-new
 * invoice's first receipt needs a follow-up upload once it exists. */
export async function downloadInvoicesAndReceiptsImportTemplate(): Promise<void> {
  const ExcelJS = await import('exceljs')

  const { data: clients } = await supabase.from('clients').select('name, client_code').order('name')
  const { data: projects } = await supabase.from('projects').select('name').eq('status', 'active').order('name')

  const wb = new ExcelJS.Workbook()

  const instructionsWs = wb.addWorksheet(SHEET_INSTRUCTIONS)
  instructionsWs.columns = [{ width: 100 }]
  ;[
    'Laavin Internal System — Invoices & Receipts Import',
    '',
    'This file has two sheets — fill in whichever one(s) apply. Leave a sheet with just its sample row untouched (or delete that row) to skip it.',
    '',
    '— Invoices —',
    ...INVOICES_INSTRUCTIONS_LINES.slice(2),
    '',
    '— Receipts —',
    ...RECEIPTS_INSTRUCTIONS_LINES.slice(2),
    '',
    "Note: a Receipts row can only be matched against an invoice that already exists in the system — it can't be applied against a new invoice defined in this same file's Invoices sheet. Import the Invoices sheet first, then upload a follow-up Receipts file once they exist.",
  ].forEach((line) => instructionsWs.addRow([line]))

  const listsWs = wb.addWorksheet(SHEET_LISTS)
  listsWs.state = 'veryHidden'

  function writeNamedColumn(col: number, name: string, values: string[]) {
    values.forEach((v, i) => (listsWs.getCell(i + 1, col).value = v))
    const letter = String.fromCharCode(64 + col)
    wb.definedNames.add(`${SHEET_LISTS}!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`, name)
  }

  const clientLabels = (clients ?? []).map((c) => clientLabel(c))
  const projectNames = (projects ?? []).map((p) => p.name)
  writeNamedColumn(1, 'Clients', clientLabels.length ? clientLabels : ['(no clients yet)'])
  writeNamedColumn(2, 'Projects', projectNames.length ? projectNames : ['(no active projects)'])
  writeNamedColumn(3, 'Statuses', [...INVOICE_STATUSES])

  const invoicesWs = wb.addWorksheet(SHEET_INVOICES)
  invoicesWs.columns = COLUMNS_INVOICES.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  invoicesWs.addRow(EXAMPLE_ROW_INVOICES)
  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    invoicesWs.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Clients'] }
    invoicesWs.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['Projects'] }
    invoicesWs.getCell(row, 8).dataValidation = { type: 'list', allowBlank: true, formulae: ['Statuses'] }
  }

  const receiptsWs = wb.addWorksheet(SHEET_RECEIPTS)
  receiptsWs.columns = COLUMNS_RECEIPTS.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  receiptsWs.addRow(EXAMPLE_ROW_RECEIPTS)
  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    receiptsWs.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Clients'] }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Invoices_and_receipts_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
