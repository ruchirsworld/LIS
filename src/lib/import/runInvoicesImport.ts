import { supabase } from '../supabase'
import { clientLabel } from '../labels'
import { fmt } from '../calc/format'
import { str, num, toDateStr, isBlankRow, sheetRowsOf } from './helpers'
import { SHEET_INVOICES, COLUMNS_INVOICES } from './invoicesSheet'
import type { ImportResultRow, ParsedRow } from './types'
import type { Database } from '../../types/database'

type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']

/** Reads and validates every row of the uploaded sheet — nothing is
 * written here; the caller reviews the result and calls
 * commitInvoicesImport with whichever rows parsed cleanly. */
export async function parseInvoicesImport(file: File): Promise<ParsedRow<InvoiceInsert>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const rows: ParsedRow<InvoiceInsert>[] = []

  const { data: clients, error: clientErr } = await supabase.from('clients').select('id, name, client_code')
  if (clientErr) throw clientErr
  const clientByLabel = new Map((clients ?? []).map((c) => [clientLabel(c).trim().toLowerCase(), c]))

  const { data: projects, error: projErr } = await supabase.from('projects').select('id, name, client_id')
  if (projErr) throw projErr
  const projectByName = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p]))

  for (const [i, row] of sheetRowsOf(wb, XLSX, SHEET_INVOICES).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const clientInput = str(row[COLUMNS_INVOICES[0]])
      const projectName = str(row[COLUMNS_INVOICES[1]])
      const invoiceNumber = str(row[COLUMNS_INVOICES[2]])
      const amount = num(row[COLUMNS_INVOICES[3]])
      const dueDays = num(row[COLUMNS_INVOICES[4]])
      const gstPct = num(row[COLUMNS_INVOICES[5]]) ?? 0
      const tdsPct = num(row[COLUMNS_INVOICES[6]]) ?? 0
      const statusInput = str(row[COLUMNS_INVOICES[7]])
      const invoiceDateInput = toDateStr(row[COLUMNS_INVOICES[8]])

      if (!clientInput) throw new Error('Client is required')
      const client = clientByLabel.get(clientInput.trim().toLowerCase())
      if (!client) throw new Error(`Client "${clientInput}" not found`)

      let projectId: string | null = null
      if (projectName) {
        const project = projectByName.get(projectName.trim().toLowerCase())
        if (!project) throw new Error(`Project "${projectName}" not found`)
        if (project.client_id !== client.id) {
          throw new Error(`Project "${projectName}" doesn't belong to Client "${clientInput}"`)
        }
        projectId = project.id
      }

      if (amount === null || amount <= 0) throw new Error('Amount is required')

      const status = statusInput.trim().toLowerCase()
      if (status !== 'draft' && status !== 'sent') {
        throw new Error(`Status must be Draft or Sent — got "${statusInput}"`)
      }
      if (status === 'sent' && !invoiceDateInput) {
        throw new Error('Invoice date is required when Status is Sent')
      }

      const payload: InvoiceInsert = {
        client_id: client.id,
        project_id: projectId,
        invoice_number: invoiceNumber || null,
        amount,
        due_days: dueDays,
        gst_pct: gstPct,
        tds_pct: tdsPct,
        status,
        invoice_date: status === 'sent' ? invoiceDateInput : null,
      }
      rows.push({
        row: rowNum,
        status: 'ready',
        preview: {
          Client: clientInput,
          Project: projectName || '—',
          Amount: fmt(amount),
          Status: status === 'sent' ? 'Sent' : 'Draft',
          'Invoice date': payload.invoice_date ?? '—',
        },
        payload,
      })
    } catch (err) {
      rows.push({ row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err), preview: {} })
    }
  }

  return rows
}

/** Actually inserts the rows the user confirmed after reviewing them. */
export async function commitInvoicesImport(rows: ParsedRow<InvoiceInsert>[]): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = []
  for (const r of rows) {
    const { error } = await supabase.from('invoices').insert(r.payload!)
    results.push(
      error
        ? { sheet: SHEET_INVOICES, row: r.row, status: 'error', message: error.message }
        : { sheet: SHEET_INVOICES, row: r.row, status: 'ok', message: 'Created invoice' }
    )
  }
  return results
}
