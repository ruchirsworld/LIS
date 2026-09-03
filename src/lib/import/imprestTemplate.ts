import { supabase } from '../supabase'
import { SHEET_IMPREST, COLUMNS_IMPREST, EXAMPLE_ROW_IMPREST, IMPREST_INSTRUCTIONS_LINES } from './imprestSheet'

const SHEET_INSTRUCTIONS = 'Instructions'
const SHEET_LISTS = 'Lists'
const DATA_ROWS = 500

function colLetter(col: number): string {
  let s = ''
  let n = col
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Builds and downloads the Site Imprest bulk-import template — Supervisor,
 * Kind, and Account are each a flat dropdown (no cross-column dependency
 * like the combined Expenses template needs), so this stays much simpler. */
export async function downloadImprestImportTemplate(): Promise<void> {
  const ExcelJS = await import('exceljs')

  const { data: profiles } = await supabase.from('profiles').select('name').eq('role', 'supervisor').order('name')
  const { data: bankAccounts } = await supabase.from('bank_accounts').select('name').order('name')

  const supervisorNames = (profiles ?? []).map((p) => p.name)
  const accountNames = ['Cash', ...(bankAccounts ?? []).map((a) => a.name)]

  const wb = new ExcelJS.Workbook()

  const instructionsWs = wb.addWorksheet(SHEET_INSTRUCTIONS)
  instructionsWs.columns = [{ width: 100 }]
  IMPREST_INSTRUCTIONS_LINES.forEach((line) => instructionsWs.addRow([line]))

  const listsWs = wb.addWorksheet(SHEET_LISTS)
  listsWs.state = 'veryHidden'

  function writeNamedColumn(col: number, name: string, values: string[]) {
    values.forEach((v, i) => (listsWs.getCell(i + 1, col).value = v))
    const letter = colLetter(col)
    wb.definedNames.add(`${SHEET_LISTS}!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`, name)
  }

  writeNamedColumn(1, 'Supervisors', supervisorNames.length ? supervisorNames : ['(no supervisors yet)'])
  writeNamedColumn(2, 'Kinds', ['Advance', 'Return'])
  writeNamedColumn(3, 'Accounts', accountNames)

  const entriesWs = wb.addWorksheet(SHEET_IMPREST)
  entriesWs.columns = COLUMNS_IMPREST.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  entriesWs.addRow(EXAMPLE_ROW_IMPREST)

  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    entriesWs.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Supervisors'] }
    entriesWs.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: ['Kinds'] }
    entriesWs.getCell(row, 5).dataValidation = { type: 'list', allowBlank: true, formulae: ['Accounts'] }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Imprest_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
