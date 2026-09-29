import { supabase } from '../supabase'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { SHEET_VENDOR_BILLS, COLUMNS_VENDOR_BILLS, PROCUREMENT_SUB_HEADS } from './vendorBillsSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type VendorBillInsert = Database['public']['Tables']['vendor_bills']['Insert']

/** Reads and validates every row of the uploaded sheet — nothing is
 * written here; the caller reviews the result and calls
 * commitVendorBillsImport with whichever rows parsed cleanly. */
export async function parseVendorBillsImport(file: File): Promise<ParsedRow<VendorBillInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })

  const rows: ParsedRow<VendorBillInsert>[] = []

  const { data: subHeads, error: shErr } = await supabase.from('expense_sub_heads').select('id, code')
  if (shErr) throw shErr
  const subHeadIdByCode = new Map((subHeads ?? []).map((s) => [s.code, s.id]))

  const { data: projects, error: projErr } = await supabase.from('projects').select('id, name, client_id')
  if (projErr) throw projErr
  const projectByName = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p]))

  const { data: vendors, error: venErr } = await supabase.from('vendors').select('id, name')
  if (venErr) throw venErr
  const vendorIdByName = new Map((vendors ?? []).map((v) => [v.name.trim().toLowerCase(), v.id]))

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_VENDOR_BILLS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const projectName = str(row[COLUMNS_VENDOR_BILLS[0]])
      const vendorName = str(row[COLUMNS_VENDOR_BILLS[1]])
      const subHeadName = str(row[COLUMNS_VENDOR_BILLS[2]])
      const date = toDateStr(row[COLUMNS_VENDOR_BILLS[3]])
      const description = str(row[COLUMNS_VENDOR_BILLS[4]])
      const amount = num(row[COLUMNS_VENDOR_BILLS[5]])
      const gstPct = num(row[COLUMNS_VENDOR_BILLS[6]]) ?? 0
      const otherCost = num(row[COLUMNS_VENDOR_BILLS[7]]) ?? 0
      const remarks = str(row[COLUMNS_VENDOR_BILLS[8]])

      if (!projectName) throw new Error('Project is required')
      const project = projectByName.get(projectName.trim().toLowerCase())
      if (!project) throw new Error(`Project "${projectName}" not found`)

      if (!vendorName) throw new Error('Vendor is required')
      const vendorId = vendorIdByName.get(vendorName.trim().toLowerCase())
      if (!vendorId) throw new Error(`Vendor "${vendorName}" not found`)

      if (!subHeadName) throw new Error('Sub Head is required')
      const subHead = PROCUREMENT_SUB_HEADS.find((s) => s.name.toLowerCase() === subHeadName.trim().toLowerCase())
      if (!subHead) {
        throw new Error(`"${subHeadName}" isn't a valid Sub Head — expected one of: ${PROCUREMENT_SUB_HEADS.map((s) => s.name).join(', ')}`)
      }
      const subHeadId = subHeadIdByCode.get(subHead.code)
      if (!subHeadId) throw new Error(`Sub-head code "${subHead.code}" not found in the Chart of Accounts`)

      if (!date) throw new Error('Bill date is required')
      if (!description) throw new Error('Bill description is required')
      if (amount === null || amount <= 0) throw new Error('Bill value is required')
      if (otherCost > 0 && !remarks) throw new Error('Remarks are required when Other cost has a value')

      const payload: VendorBillInsert = {
        vendor_id: vendorId,
        sub_head_id: subHeadId,
        description,
        remarks: remarks || null,
        client_id: project.client_id,
        project_id: project.id,
        date,
        amount,
        gst_pct: gstPct,
        other_cost: otherCost,
        qty: null,
        rate: null,
      }
      const total = amount + (amount * gstPct) / 100 + otherCost
      rows.push({
        row: rowNum,
        status: 'ready',
        preview: { Date: date, Vendor: vendorName, 'Sub Head': subHead.name, Description: description, Total: fmt(total) },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitVendorBillsImport(rows: ParsedRow<VendorBillInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('vendor_bills').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_VENDOR_BILLS, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_VENDOR_BILLS, row: r.row, status: 'ok', message: 'Created bill' }
    )
  }
  return results
}
