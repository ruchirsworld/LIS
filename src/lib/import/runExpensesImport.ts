import { supabase } from '../supabase'
import { ADMIN_QUICK_CATEGORIES } from '../adminQuickCategories'
import { TRIP_QUICK_CATEGORIES } from '../tripQuickCategories'
import type { QuickCategory } from '../quickCategories'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { SHEET_EXPENSES, COLUMNS_EXPENSES, PROJECT_MAJOR_HEADS } from './expensesSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

/** Resolves a (Description group, Sub Head option) pair against one
 * QuickCategory taxonomy — a group with no `options` is a direct one-tap
 * pick, so its own label is both the description and the (ignored) sub
 * head cell; a group with options requires the option to match one of them. */
function resolveQuickPick(
  categories: QuickCategory[],
  groupLabel: string,
  optionLabel: string
): { subHeadCode: string; description: string } | null {
  const group = categories.find((c) => c.label.trim().toLowerCase() === groupLabel.trim().toLowerCase())
  if (!group) return null
  if (!group.options) return { subHeadCode: group.subHeadCode!, description: group.label }
  const option = group.options.find((o) => o.label.trim().toLowerCase() === optionLabel.trim().toLowerCase())
  if (!option) return null
  return { subHeadCode: option.subHeadCode, description: option.label }
}

/** Reads and validates every row of the uploaded sheet — Admin and Trips
 * resolve Description/Sub Head the same way the app's own quick-tap picker
 * does; Project resolves them as Major head/Sub-head. Nothing is written
 * here; the caller reviews the result and calls commitExpensesImport with
 * whichever rows parsed cleanly. Same read-side CVE note as elsewhere in
 * this app applies (SheetJS on an admin's own upload only). */
export async function parseExpensesImport(file: File): Promise<ParsedRow<ExpenseInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })

  const rows: ParsedRow<ExpenseInsert>[] = []

  const { data: subHeads, error: shErr } = await supabase.from('expense_sub_heads').select('id, code, name, major_head_code')
  if (shErr) throw shErr
  const subHeadIdByCode = new Map((subHeads ?? []).map((s) => [s.code, s.id]))

  const { data: bankAccounts, error: baErr } = await supabase.from('bank_accounts').select('id, name')
  if (baErr) throw baErr
  const bankAccountMap = new Map((bankAccounts ?? []).map((a) => [a.name.trim().toLowerCase(), a.id]))

  const { data: projects, error: projErr } = await supabase.from('projects').select('id, name')
  if (projErr) throw projErr
  const projectIdByName = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]))

  const { data: trips, error: tripErr } = await supabase.from('trips').select('id, name, traveler_id, cost_center, project_id')
  if (tripErr) throw tripErr
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, name')
  if (profErr) throw profErr
  const profileNameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
  const tripByLabel = new Map(
    (trips ?? []).map((t) => [`${t.name} — ${profileNameById.get(t.traveler_id) ?? 'Unknown'}`.trim().toLowerCase(), t])
  )

  // Existing expenses to check new rows against — same key as the
  // within-file check below (cost center, project/trip, sub-head, date, amount).
  const { data: existingExpenses, error: existErr } = await supabase
    .from('expenses')
    .select('cost_center, project_id, trip_id, sub_head_id, date, amount')
  if (existErr) throw existErr
  const existingKeys = new Set(
    (existingExpenses ?? []).map(
      (e) => `${e.cost_center}|${e.project_id}|${e.trip_id}|${e.sub_head_id}|${e.date}|${Number(e.amount)}`
    )
  )
  const seenInFile = new Map<string, number>()

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_EXPENSES).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const costCenter = str(row[COLUMNS_EXPENSES[0]])
      const projectName = str(row[COLUMNS_EXPENSES[1]])
      const tripLabel = str(row[COLUMNS_EXPENSES[2]])
      const description = str(row[COLUMNS_EXPENSES[3]])
      const subHeadOption = str(row[COLUMNS_EXPENSES[4]])
      const date = toDateStr(row[COLUMNS_EXPENSES[5]])
      const amount = num(row[COLUMNS_EXPENSES[6]])
      const accountInput = str(row[COLUMNS_EXPENSES[7]])
      const remarks = str(row[COLUMNS_EXPENSES[8]])

      if (!['Admin', 'Trips', 'Project'].includes(costCenter)) {
        throw new Error(`Cost Center must be Admin, Trips, or Project — got "${costCenter}"`)
      }
      if (!date) throw new Error('Date is required')
      if (amount === null) throw new Error('Amount is required')
      if (!accountInput) throw new Error('Account is required')
      if (!description) throw new Error('Description is required')

      let subHeadId: string | null = null
      let finalDescription = description
      let projectId: string | null = null
      let tripId: string | null = null

      if (costCenter === 'Admin' || costCenter === 'Trips') {
        const categories = costCenter === 'Admin' ? ADMIN_QUICK_CATEGORIES : TRIP_QUICK_CATEGORIES
        const resolved = resolveQuickPick(categories, description, subHeadOption)
        if (!resolved) {
          throw new Error(`"${subHeadOption || '(blank)'}" isn't a Sub Head option under Description "${description}"`)
        }
        subHeadId = subHeadIdByCode.get(resolved.subHeadCode) ?? null
        if (!subHeadId) throw new Error(`Sub-head code "${resolved.subHeadCode}" not found in the Chart of Accounts`)
        finalDescription = resolved.description

        if (costCenter === 'Trips') {
          if (!tripLabel) throw new Error('Trip is required for a Trips row')
          const trip = tripByLabel.get(tripLabel.trim().toLowerCase())
          if (!trip) throw new Error(`Trip "${tripLabel}" not found`)
          tripId = trip.id
          projectId = trip.project_id
        }
      } else {
        const head = PROJECT_MAJOR_HEADS.find((h) => h.name.toLowerCase() === description.toLowerCase())
        if (!head) {
          throw new Error(`"${description}" isn't a valid Project Description — expected one of: ${PROJECT_MAJOR_HEADS.map((h) => h.name).join(', ')}`)
        }
        if (!subHeadOption) throw new Error('Sub Head is required for a Project row')
        const sh = (subHeads ?? []).find((s) => s.major_head_code === head.code && s.name.trim().toLowerCase() === subHeadOption.trim().toLowerCase())
        if (!sh) throw new Error(`"${subHeadOption}" isn't a Sub Head under "${description}"`)
        subHeadId = sh.id
        finalDescription = sh.name

        if (!projectName) throw new Error('Project is required for a Project row')
        const foundProjectId = projectIdByName.get(projectName.trim().toLowerCase())
        if (!foundProjectId) throw new Error(`Project "${projectName}" not found`)
        projectId = foundProjectId
      }

      let paymentMode: string | null = null
      let bankAccountId: string | null = null
      let reimbursable = false
      const accountKey = accountInput.trim().toLowerCase()
      if (accountKey === 'cash') {
        paymentMode = 'Cash'
      } else if (accountKey === 'reimburse' || accountKey === 'reimbursement') {
        reimbursable = true
      } else {
        const found = bankAccountMap.get(accountKey)
        if (!found) {
          throw new Error(`Account "${accountInput}" doesn't match Cash, Reimburse, or a known bank account`)
        }
        paymentMode = 'Bank'
        bankAccountId = found
      }

      const dedupeKey = `${costCenter}|${projectId}|${tripId}|${subHeadId}|${date}|${amount}`
      let warning: string | undefined
      if (existingKeys.has(dedupeKey)) {
        warning = 'Matches an expense already in the system (same cost center, project/trip, sub head, date, amount)'
      } else if (seenInFile.has(dedupeKey)) {
        warning = `Duplicates row ${seenInFile.get(dedupeKey)} in this file`
      }
      seenInFile.set(dedupeKey, rowNum)

      const payload: ExpenseInsert = {
        description: finalDescription,
        cost_center: costCenter,
        project_id: projectId,
        sub_head_id: subHeadId,
        amount,
        date,
        remarks: remarks || null,
        payment_mode: paymentMode,
        bank_account_id: bankAccountId,
        reimbursable,
        trip_id: tripId,
      }
      rows.push({
        row: rowNum,
        status: 'ready',
        warning,
        preview: { Date: date, 'Cost Center': costCenter, Description: finalDescription, Amount: fmt(amount), Account: accountInput },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitExpensesImport(rows: ParsedRow<ExpenseInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('expenses').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_EXPENSES, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_EXPENSES, row: r.row, status: 'ok', message: 'Created expense', warning: r.warning }
    )
  }
  return results
}
