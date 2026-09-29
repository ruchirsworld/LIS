import { supabase } from '../supabase'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { SHEET_IMPREST, COLUMNS_IMPREST } from './imprestSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type ImprestInsert = Database['public']['Tables']['staff_imprest_transactions']['Insert']

/** Reads and validates every row of the uploaded Site Imprest sheet.
 * Nothing is written here; the caller reviews the result and calls
 * commitImprestImport with whichever rows parsed cleanly. */
export async function parseImprestImport(file: File): Promise<ParsedRow<ImprestInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })

  const rows: ParsedRow<ImprestInsert>[] = []

  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, name').eq('role', 'supervisor')
  if (profErr) throw profErr
  const supervisorIdByName = new Map((profiles ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]))

  const { data: bankAccounts, error: baErr } = await supabase.from('bank_accounts').select('id, name')
  if (baErr) throw baErr
  const bankAccountIdByName = new Map((bankAccounts ?? []).map((a) => [a.name.trim().toLowerCase(), a.id]))

  // Existing transactions to check new rows against — same key as the
  // within-file check below (supervisor, date, kind, amount).
  const { data: existing, error: existErr } = await supabase.from('staff_imprest_transactions').select('profile_id, date, kind, amount')
  if (existErr) throw existErr
  const existingKeys = new Set((existing ?? []).map((t) => `${t.profile_id}|${t.date}|${t.kind}|${Number(t.amount)}`))
  const seenInFile = new Map<string, number>()

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_IMPREST).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const supervisorName = str(row[COLUMNS_IMPREST[0]])
      const date = toDateStr(row[COLUMNS_IMPREST[1]])
      const kindInput = str(row[COLUMNS_IMPREST[2]])
      const amount = num(row[COLUMNS_IMPREST[3]])
      const accountInput = str(row[COLUMNS_IMPREST[4]])
      const remarks = str(row[COLUMNS_IMPREST[5]])

      if (!supervisorName) throw new Error('Supervisor is required')
      const profileId = supervisorIdByName.get(supervisorName.trim().toLowerCase())
      if (!profileId) throw new Error(`Supervisor "${supervisorName}" not found`)

      if (!date) throw new Error('Date is required')

      const kindKey = kindInput.trim().toLowerCase()
      if (kindKey !== 'advance' && kindKey !== 'return') {
        throw new Error(`Kind must be Advance or Return — got "${kindInput}"`)
      }

      if (amount === null || amount <= 0) throw new Error('Amount must be a positive number')

      if (!accountInput) throw new Error('Account is required')
      let bankAccountId: string | null = null
      if (accountInput.trim().toLowerCase() !== 'cash') {
        const found = bankAccountIdByName.get(accountInput.trim().toLowerCase())
        if (!found) throw new Error(`Account "${accountInput}" doesn't match Cash or a known bank account`)
        bankAccountId = found
      }

      const dedupeKey = `${profileId}|${date}|${kindKey}|${amount}`
      let warning: string | undefined
      if (existingKeys.has(dedupeKey)) {
        warning = 'Matches a transaction already in the system (same supervisor, date, kind, amount)'
      } else if (seenInFile.has(dedupeKey)) {
        warning = `Duplicates row ${seenInFile.get(dedupeKey)} in this file`
      }
      seenInFile.set(dedupeKey, rowNum)

      const payload: ImprestInsert = {
        profile_id: profileId,
        date,
        kind: kindKey as 'advance' | 'return',
        amount,
        bank_account_id: bankAccountId,
        remarks: remarks || null,
      }
      rows.push({
        row: rowNum,
        status: 'ready',
        warning,
        preview: { Supervisor: supervisorName, Date: date, Kind: kindKey === 'advance' ? 'Advance' : 'Return', Amount: fmt(amount), Account: accountInput },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitImprestImport(rows: ParsedRow<ImprestInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('staff_imprest_transactions').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_IMPREST, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_IMPREST, row: r.row, status: 'ok', message: 'Created transaction', warning: r.warning }
    )
  }
  return results
}
