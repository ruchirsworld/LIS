import { supabase } from '../supabase'
import {
  SHEET_VENDOR_BILLS,
  COLUMNS_VENDOR_BILLS,
  PROCUREMENT_SUB_HEADS,
  EXAMPLE_ROW_VENDOR_BILLS,
  VENDOR_BILLS_INSTRUCTIONS_LINES,
} from './vendorBillsSheet'

const SHEET_INSTRUCTIONS = 'Instructions'
const SHEET_LISTS = 'Lists'
const DATA_ROWS = 500

/** Builds and downloads the Procurements bulk-import template. Simpler
 * than the Expenses one — every dropdown here is a flat, independent list
 * (no cross-column dependency), since Procurement always posts to one
 * fixed set of 4 sub-heads regardless of which project or vendor is
 * picked. Uses exceljs for the same reason as expensesTemplate.ts: cell
 * dropdowns are a paid-tier feature in the xlsx package used elsewhere. */
export async function downloadVendorBillsImportTemplate(): Promise<void> {
  const ExcelJS = await import('exceljs')

  const { data: projects } = await supabase.from('projects').select('name').eq('status', 'active').order('name')
  const { data: vendors } = await supabase.from('vendors').select('name').order('name')

  const wb = new ExcelJS.Workbook()

  const instructionsWs = wb.addWorksheet(SHEET_INSTRUCTIONS)
  instructionsWs.columns = [{ width: 100 }]
  VENDOR_BILLS_INSTRUCTIONS_LINES.forEach((line) => instructionsWs.addRow([line]))

  const listsWs = wb.addWorksheet(SHEET_LISTS)
  listsWs.state = 'veryHidden'

  function writeNamedColumn(col: number, name: string, values: string[]) {
    values.forEach((v, i) => (listsWs.getCell(i + 1, col).value = v))
    const letter = String.fromCharCode(64 + col)
    wb.definedNames.add(`${SHEET_LISTS}!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`, name)
  }

  const projectNames = (projects ?? []).map((p) => p.name)
  const vendorNames = (vendors ?? []).map((v) => v.name)
  writeNamedColumn(1, 'Projects', projectNames.length ? projectNames : ['(no active projects)'])
  writeNamedColumn(2, 'Vendors', vendorNames.length ? vendorNames : ['(no vendors yet)'])
  writeNamedColumn(
    3,
    'SubHeads',
    PROCUREMENT_SUB_HEADS.map((s) => s.name)
  )

  const billsWs = wb.addWorksheet(SHEET_VENDOR_BILLS)
  billsWs.columns = COLUMNS_VENDOR_BILLS.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  billsWs.addRow(EXAMPLE_ROW_VENDOR_BILLS)

  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    billsWs.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Projects'] }
    billsWs.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['Vendors'] }
    billsWs.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: ['SubHeads'] }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Procurements_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
