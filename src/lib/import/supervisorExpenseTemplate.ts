import { supabase } from '../supabase'
import { FIXED_EXPENSE_CATEGORIES } from '../supervisorProjectExpenseCategories'
import {
  SHEET_SUPERVISOR_EXPENSES,
  COLUMNS_SUPERVISOR_EXPENSES,
  EXAMPLE_ROW_SUPERVISOR_EXPENSES,
  SUPERVISOR_EXPENSES_INSTRUCTIONS_LINES,
} from './supervisorExpenseSheet'

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

/** Builds and downloads the Supervisor Project-expense-claim bulk-import
 * template — Supervisor, Project, and Category are each a flat dropdown. */
export async function downloadSupervisorExpenseImportTemplate(): Promise<void> {
  const ExcelJS = await import('exceljs')

  const { data: profiles } = await supabase.from('profiles').select('name').eq('role', 'supervisor').order('name')
  const { data: projects } = await supabase.from('projects').select('name').eq('status', 'active').order('name')

  const supervisorNames = (profiles ?? []).map((p) => p.name)
  const projectNames = (projects ?? []).map((p) => p.name)
  const categoryLabels = ['Labour', ...FIXED_EXPENSE_CATEGORIES.map((c) => c.label)]

  const wb = new ExcelJS.Workbook()

  const instructionsWs = wb.addWorksheet(SHEET_INSTRUCTIONS)
  instructionsWs.columns = [{ width: 100 }]
  SUPERVISOR_EXPENSES_INSTRUCTIONS_LINES.forEach((line) => instructionsWs.addRow([line]))

  const listsWs = wb.addWorksheet(SHEET_LISTS)
  listsWs.state = 'veryHidden'

  function writeNamedColumn(col: number, name: string, values: string[]) {
    values.forEach((v, i) => (listsWs.getCell(i + 1, col).value = v))
    const letter = colLetter(col)
    wb.definedNames.add(`${SHEET_LISTS}!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`, name)
  }

  writeNamedColumn(1, 'Supervisors', supervisorNames.length ? supervisorNames : ['(no supervisors yet)'])
  writeNamedColumn(2, 'Projects', projectNames.length ? projectNames : ['(no active projects)'])
  writeNamedColumn(3, 'Categories', categoryLabels)

  const entriesWs = wb.addWorksheet(SHEET_SUPERVISOR_EXPENSES)
  entriesWs.columns = COLUMNS_SUPERVISOR_EXPENSES.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  entriesWs.addRow(EXAMPLE_ROW_SUPERVISOR_EXPENSES)

  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    entriesWs.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Supervisors'] }
    entriesWs.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['Projects'] }
    entriesWs.getCell(row, 4).dataValidation = { type: 'list', allowBlank: true, formulae: ['Categories'] }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Supervisor_expense_claims_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
