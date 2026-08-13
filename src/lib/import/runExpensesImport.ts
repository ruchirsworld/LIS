import { supabase } from '../supabase'
import { str, num, toDateStr, isBlankRow, yesNo, paymentModeOf, sheetRowsOf } from './helpers'
import { SHEET_EXPENSES, COLUMNS_EXPENSES } from './expensesSheet'
import type { ImportResultRow } from './runImport'

const PROJECTS_COST_CENTER = 'projects'

/** Parses and imports the standalone Expenses file. Same read-side CVE note
 * as runImport.ts applies (SheetJS on an admin's own upload only). */
export async function runExpensesImport(file: File): Promise<ImportResultRow[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const results: ImportResultRow[] = []

  const { data: costCenters, error: ccErr } = await supabase.from('cost_centers').select('name')
  if (ccErr) throw ccErr
  const costCenterNames = costCenters?.map((c) => c.name) ?? []
  const costCenterMap = new Map(costCenterNames.map((n) => [n.trim().toLowerCase(), n]))

  const { data: projects, error: projErr } = await supabase.from('projects').select('id, name')
  if (projErr) throw projErr
  const projectMap = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]))

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_EXPENSES).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const costCenterInput = str(row[COLUMNS_EXPENSES[0]])
      const projectName = str(row[COLUMNS_EXPENSES[1]])
      const tags = str(row[COLUMNS_EXPENSES[2]])
      const amount = num(row[COLUMNS_EXPENSES[3]])
      const date = toDateStr(row[COLUMNS_EXPENSES[4]])
      const remarks = str(row[COLUMNS_EXPENSES[5]])

      if (!costCenterInput) throw new Error('Cost Center is required')
      const costCenter = costCenterMap.get(costCenterInput.trim().toLowerCase())
      if (!costCenter) {
        throw new Error(
          `Cost Center "${costCenterInput}" doesn't match any existing cost center (${costCenterNames.join(', ') || 'none set up yet'})`,
        )
      }
      if (!tags) throw new Error('Tags are required')
      if (amount === null) throw new Error('Amount is required')
      if (!date) throw new Error('Date is required')

      let projectId: string | null = null
      if (costCenter.trim().toLowerCase() === PROJECTS_COST_CENTER) {
        if (!projectName) throw new Error('Project Name is required when Cost Center is Projects')
        const found = projectMap.get(projectName.trim().toLowerCase())
        if (!found) throw new Error(`Project "${projectName}" not found — create it first via Admin → Projects`)
        projectId = found
      }

      const reimbursable = yesNo(row[COLUMNS_EXPENSES[7]])
      const { error } = await supabase.from('expenses').insert({
        description: tags,
        cost_center: costCenter,
        project_id: projectId,
        amount,
        date,
        remarks: remarks || null,
        // Payment mode and Reimbursable are mutually exclusive — an expense
        // is either settled a specific way, or still owed back to whoever
        // fronted it, never both.
        payment_mode: reimbursable ? null : paymentModeOf(row[COLUMNS_EXPENSES[6]]),
        reimbursable,
      })
      if (error) throw error
      results.push({ sheet: SHEET_EXPENSES, row: rowNum, status: 'ok', message: 'Created expense' })
    } catch (err) {
      results.push({ sheet: SHEET_EXPENSES, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}
