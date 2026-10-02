import { supabase } from '../supabase'
import { ADMIN_QUICK_CATEGORIES } from '../adminQuickCategories'
import { TRIP_QUICK_CATEGORIES } from '../tripQuickCategories'
import { SHEET_EXPENSES, COLUMNS_EXPENSES, EXAMPLE_ROW_EXPENSES, EXPENSES_INSTRUCTIONS_LINES, PROJECT_MAJOR_HEADS } from './expensesSheet'
import { isProjectSubHeadCode } from '../projectSubHeads'

const SHEET_INSTRUCTIONS = 'Instructions'
const SHEET_LISTS = 'Lists'
// Enough rows for a large batch without the file ballooning.
const DATA_ROWS = 500

const COST_CENTERS = ['Admin', 'Trips', 'Project'] as const

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

/** Builds and downloads the common bulk-add-expenses template, covering
 * Admin, Trips, and Project rows in one file. Uses exceljs (not xlsx) so
 * cell dropdowns and named ranges can be written — a paid-tier feature in
 * the xlsx package already used elsewhere in this app. Dynamically
 * imported so this ~1MB dependency never loads unless someone actually
 * downloads this template.
 *
 * Cost Center → Description → Sub Head is a genuine 2-level dependency
 * across three different taxonomies (Admin/Trips quick-tap groups, and
 * Project's Major head → Sub-head). Rather than sanitizing arbitrary
 * category labels into named-range identifiers, each cost center's group
 * list is looked up by its literal value ("AdminGroups"/"TripsGroups"/
 * "ProjectGroups"), and each group's own Sub Head list is looked up by
 * position — MATCH() finds where the picked Description sits in that
 * cost center's group list, and INDIRECT builds "SH_<CostCenter>_<n>" from
 * it. That naming scheme is authored here and must stay in lockstep with
 * itself — there's nothing external it needs to match. */
export async function downloadExpensesImportTemplate(): Promise<void> {
  const ExcelJS = await import('exceljs')

  const { data: projects } = await supabase.from('projects').select('id, name').eq('status', 'active').order('name')
  const { data: trips } = await supabase.from('trips').select('id, name, traveler_id').order('start_date', { ascending: false })
  const { data: profiles } = await supabase.from('profiles').select('id, name')
  const { data: subHeads } = await supabase.from('expense_sub_heads').select('code, name, major_head_code')

  const profileNameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const tripLabels = (trips ?? []).map((t) => `${t.name} — ${profileNameById.get(t.traveler_id) ?? 'Unknown'}`)
  const projectNames = (projects ?? []).map((p) => p.name)

  const adminGroupLabels = ADMIN_QUICK_CATEGORIES.map((c) => c.label)
  const tripGroupLabels = TRIP_QUICK_CATEGORIES.map((c) => c.label)
  const projectGroupLabels = PROJECT_MAJOR_HEADS.map((h) => h.name)

  // One option list per group, in the same order as its group list above —
  // a group with no `options` (a direct one-tap pick, e.g. Admin's "Misc")
  // gets a single placeholder entry since there's nothing to actually pick.
  const adminSubHeadLists = ADMIN_QUICK_CATEGORIES.map((c) => (c.options ?? []).map((o) => o.label)).map((list) =>
    list.length ? list : ['(not applicable — leave blank)']
  )
  const tripSubHeadLists = TRIP_QUICK_CATEGORIES.map((c) => (c.options ?? []).map((o) => o.label)).map((list) =>
    list.length ? list : ['(not applicable — leave blank)']
  )
  const projectSubHeadLists = PROJECT_MAJOR_HEADS.map((h) =>
    (subHeads ?? []).filter((s) => s.major_head_code === h.code && isProjectSubHeadCode(s.code)).map((s) => s.name)
  )

  const wb = new ExcelJS.Workbook()

  const instructionsWs = wb.addWorksheet(SHEET_INSTRUCTIONS)
  instructionsWs.columns = [{ width: 100 }]
  EXPENSES_INSTRUCTIONS_LINES.forEach((line) => instructionsWs.addRow([line]))

  // Hidden sheet every dropdown points at.
  const listsWs = wb.addWorksheet(SHEET_LISTS)
  listsWs.state = 'veryHidden'

  function writeNamedColumn(col: number, name: string, values: string[]) {
    values.forEach((v, i) => (listsWs.getCell(i + 1, col).value = v))
    const letter = colLetter(col)
    wb.definedNames.add(`${SHEET_LISTS}!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`, name)
  }

  writeNamedColumn(1, 'CostCenters', [...COST_CENTERS])
  writeNamedColumn(2, 'Projects', projectNames.length ? projectNames : ['(no active projects)'])
  writeNamedColumn(3, 'Trips', tripLabels.length ? tripLabels : ['(no trips yet)'])
  writeNamedColumn(4, 'AdminGroups', adminGroupLabels)
  writeNamedColumn(5, 'TripsGroups', tripGroupLabels)
  writeNamedColumn(6, 'ProjectGroups', projectGroupLabels)

  let col = 7
  adminSubHeadLists.forEach((list, i) => writeNamedColumn(col++, `SH_Admin_${i + 1}`, list))
  tripSubHeadLists.forEach((list, i) => writeNamedColumn(col++, `SH_Trips_${i + 1}`, list))
  projectSubHeadLists.forEach((list, i) => writeNamedColumn(col++, `SH_Project_${i + 1}`, list))

  const entriesWs = wb.addWorksheet(SHEET_EXPENSES)
  entriesWs.columns = COLUMNS_EXPENSES.map((c) => ({ header: c, width: Math.max(20, c.length) }))
  entriesWs.addRow(EXAMPLE_ROW_EXPENSES)

  const COST_CENTER_COL = 1
  const DESCRIPTION_COL = 4
  const SUB_HEAD_COL = 5

  for (let row = 2; row <= DATA_ROWS + 1; row++) {
    entriesWs.getCell(row, COST_CENTER_COL).dataValidation = { type: 'list', allowBlank: true, formulae: ['CostCenters'] }
    entriesWs.getCell(row, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['Projects'] }
    entriesWs.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: ['Trips'] }
    entriesWs.getCell(row, DESCRIPTION_COL).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`INDIRECT($A${row}&"Groups")`],
    }
    entriesWs.getCell(row, SUB_HEAD_COL).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`INDIRECT("SH_"&$A${row}&"_"&MATCH($D${row},INDIRECT($A${row}&"Groups"),0))`],
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Expenses_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
