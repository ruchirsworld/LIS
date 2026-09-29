import { supabase } from '../supabase'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { FIXED_EXPENSE_CATEGORIES, LABOUR_SUB_HEAD_CODE } from '../supervisorProjectExpenseCategories'
import { SHEET_SUPERVISOR_EXPENSES, COLUMNS_SUPERVISOR_EXPENSES } from './supervisorExpenseSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

/** Reads and validates every row of the uploaded Supervisor claims sheet.
 * Each row becomes one pending Project expense claim, `created_by` set to
 * the named Supervisor — exactly what submitting via
 * SupervisorProjectExpenseForm produces, just entered in bulk on their
 * behalf. It still needs an Admin/CXO to approve it and decide funding on
 * the Approvals page, the same as any other upload into this app — bulk
 * entry isn't a shortcut around that review. Nothing is written here; the
 * caller reviews the result and calls commitSupervisorExpenseImport with
 * whichever rows parsed cleanly. */
export async function parseSupervisorExpenseImport(file: File): Promise<ParsedRow<ExpenseInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })

  const rows: ParsedRow<ExpenseInsert>[] = []

  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, name').eq('role', 'supervisor')
  if (profErr) throw profErr
  const supervisorIdByName = new Map((profiles ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]))

  const { data: projects, error: projErr } = await supabase.from('projects').select('id, name').eq('status', 'active')
  if (projErr) throw projErr
  const projectIdByName = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]))

  const { data: subHeads, error: shErr } = await supabase.from('expense_sub_heads').select('id, code')
  if (shErr) throw shErr
  const subHeadIdByCode = new Map((subHeads ?? []).map((s) => [s.code, s.id]))

  // Existing claims/expenses to check new rows against — same key as the
  // within-file check below (creator, project, date, sub-head, amount).
  const { data: existingExpenses, error: expErr } = await supabase
    .from('expenses')
    .select('created_by, project_id, date, sub_head_id, amount')
    .eq('cost_center', 'Project')
  if (expErr) throw expErr
  const existingKeys = new Set(
    (existingExpenses ?? []).map((e) => `${e.created_by}|${e.project_id}|${e.date}|${e.sub_head_id}|${Number(e.amount)}`)
  )
  const seenInFile = new Map<string, number>()

  const categoryByLabel = new Map<string, string>([['labour', LABOUR_SUB_HEAD_CODE]])
  for (const c of FIXED_EXPENSE_CATEGORIES) categoryByLabel.set(c.label.trim().toLowerCase(), c.subHeadCode)

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_SUPERVISOR_EXPENSES).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const supervisorName = str(row[COLUMNS_SUPERVISOR_EXPENSES[0]])
      const projectName = str(row[COLUMNS_SUPERVISOR_EXPENSES[1]])
      const date = toDateStr(row[COLUMNS_SUPERVISOR_EXPENSES[2]])
      const categoryInput = str(row[COLUMNS_SUPERVISOR_EXPENSES[3]])
      const amount = num(row[COLUMNS_SUPERVISOR_EXPENSES[4]])
      const comments = str(row[COLUMNS_SUPERVISOR_EXPENSES[5]])

      if (!supervisorName) throw new Error('Supervisor is required')
      const supervisorId = supervisorIdByName.get(supervisorName.trim().toLowerCase())
      if (!supervisorId) throw new Error(`Supervisor "${supervisorName}" not found`)

      if (!projectName) throw new Error('Project is required')
      const projectId = projectIdByName.get(projectName.trim().toLowerCase())
      if (!projectId) throw new Error(`Project "${projectName}" not found`)

      if (!date) throw new Error('Date is required')

      const subHeadCode = categoryByLabel.get(categoryInput.trim().toLowerCase())
      if (!subHeadCode) {
        throw new Error(
          `Category must be one of: Labour, ${FIXED_EXPENSE_CATEGORIES.map((c) => c.label).join(', ')} — got "${categoryInput}"`
        )
      }
      if (categoryInput.trim().toLowerCase() === 'miscellaneous' && !comments) {
        throw new Error('Comments are required when Category is Miscellaneous')
      }

      if (amount === null || amount <= 0) throw new Error('Amount must be a positive number')

      const subHeadId = subHeadIdByCode.get(subHeadCode) ?? null
      if (!subHeadId) throw new Error(`Sub-head code "${subHeadCode}" not found in the Chart of Accounts`)

      const dedupeKey = `${supervisorId}|${projectId}|${date}|${subHeadId}|${amount}`
      let warning: string | undefined
      if (existingKeys.has(dedupeKey)) {
        warning = 'Matches a claim already in the system (same supervisor, project, date, category, amount)'
      } else if (seenInFile.has(dedupeKey)) {
        warning = `Duplicates row ${seenInFile.get(dedupeKey)} in this file`
      }
      seenInFile.set(dedupeKey, rowNum)

      // guard_expense_status only forces 'pending' for a non-admin/cxo
      // session — this import always runs as one, so 'pending' has to be
      // set explicitly here or it would default straight to 'approved'.
      const payload: ExpenseInsert = {
        description: comments || categoryInput,
        cost_center: 'Project',
        project_id: projectId,
        sub_head_id: subHeadId,
        amount,
        date,
        status: 'pending',
        reimbursable: false,
        receipt_path: null,
        created_by: supervisorId,
      }
      rows.push({
        row: rowNum,
        status: 'ready',
        warning,
        preview: { Supervisor: supervisorName, Project: projectName, Date: date, Category: categoryInput, Amount: fmt(amount) },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitSupervisorExpenseImport(rows: ParsedRow<ExpenseInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('expenses').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_SUPERVISOR_EXPENSES, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_SUPERVISOR_EXPENSES, row: r.row, status: 'ok', message: 'Created claim', warning: r.warning }
    )
  }
  return results
}
