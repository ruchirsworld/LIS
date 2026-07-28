import { supabase } from '../supabase'
import {
  SHEET_PROJECTS,
  SHEET_INVOICES,
  SHEET_PAYMENTS,
  SHEET_LOANS,
  SHEET_LOAN_PAYMENTS,
  COLUMNS_PROJECTS,
  COLUMNS_INVOICES,
  COLUMNS_PAYMENTS,
  COLUMNS_LOANS,
  COLUMNS_LOAN_PAYMENTS,
} from './sheets'

export interface ImportResultRow {
  sheet: string
  row: number
  status: 'ok' | 'error' | 'skipped'
  message: string
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function num(v: unknown): number | null {
  const s = str(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = str(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => str(v) === '')
}

function invoiceStatus(v: unknown, hasDate: boolean): 'draft' | 'sent' {
  const s = str(v).toLowerCase()
  if (s === 'draft') return 'draft'
  if (s === 'sent') return 'sent'
  return hasDate ? 'sent' : 'draft'
}

function projectStatus(v: unknown): 'active' | 'completed' {
  return str(v).toLowerCase() === 'completed' ? 'completed' : 'active'
}

function loanTypeOf(v: unknown): 'private' | 'bank' {
  return str(v).toLowerCase() === 'bank' ? 'bank' : 'private'
}

function paymentModeOf(v: unknown): 'UPI' | 'Cash' | 'Bank' | null {
  const s = str(v)
  return s === 'UPI' || s === 'Cash' || s === 'Bank' ? s : null
}

/** Parses the uploaded workbook and writes every row it can, sheet by sheet
 * (Projects → Invoices → Payments Received → Loans → Loan Payments), so
 * later sheets can resolve the Clients/Projects/Invoices/Loans earlier
 * sheets just created. One bad row is reported and skipped, not fatal to
 * the rest of the file. */
export async function runImport(file: File): Promise<ImportResultRow[]> {
  // SheetJS has two known CVEs (prototype pollution, ReDoS), both only
  // reachable via XLSX.read/readFile on untrusted input. This *is* that read
  // path — but the only file it ever parses is one the signed-in Admin
  // uploads themselves (this whole feature is gated behind the Admin-only
  // tab), so the realistic attack would be an admin attacking their own
  // session, not a third party.
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })

  const results: ImportResultRow[] = []

  function sheetRows(name: string): Record<string, unknown>[] {
    const ws = wb.Sheets[name]
    if (!ws) return []
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  }

  // Master-data caches, preloaded so repeated names across many rows only
  // need one lookup-or-create each.
  const clientCache = new Map<string, string>()
  const projectCache = new Map<string, string>()

  const { data: existingClients, error: clientsErr } = await supabase.from('clients').select('id, name')
  if (clientsErr) throw clientsErr
  existingClients?.forEach((c) => clientCache.set(c.name.trim().toLowerCase(), c.id))

  const { data: existingProjects, error: projectsErr } = await supabase.from('projects').select('id, name, client_id')
  if (projectsErr) throw projectsErr
  existingProjects?.forEach((p) => projectCache.set(`${p.client_id}::${p.name.trim().toLowerCase()}`, p.id))

  async function resolveClientId(name: string): Promise<string> {
    const key = name.trim().toLowerCase()
    const cached = clientCache.get(key)
    if (cached) return cached
    const { data, error } = await supabase.from('clients').insert({ name: name.trim() }).select('id').single()
    if (error) throw error
    clientCache.set(key, data.id)
    return data.id
  }

  async function resolveProjectId(clientId: string, name: string): Promise<string> {
    const key = `${clientId}::${name.trim().toLowerCase()}`
    const cached = projectCache.get(key)
    if (cached) return cached
    const { data, error } = await supabase
      .from('projects')
      .insert({ client_id: clientId, name: name.trim() })
      .select('id')
      .single()
    if (error) throw error
    projectCache.set(key, data.id)
    return data.id
  }

  // ---- 1. Projects ----
  for (const [i, row] of sheetRows(SHEET_PROJECTS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const clientName = str(row[COLUMNS_PROJECTS[0]])
      const projectName = str(row[COLUMNS_PROJECTS[1]])
      if (!clientName || !projectName) throw new Error('Client Name and Project Name are required')

      const clientId = await resolveClientId(clientName)
      const key = `${clientId}::${projectName.toLowerCase()}`
      if (projectCache.has(key)) {
        results.push({
          sheet: SHEET_PROJECTS,
          row: rowNum,
          status: 'skipped',
          message: `Project "${projectName}" already exists for ${clientName} — left as-is`,
        })
        continue
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          client_id: clientId,
          name: projectName,
          cost_center: str(row[COLUMNS_PROJECTS[2]]) || null,
          budget: num(row[COLUMNS_PROJECTS[3]]),
          value_ex_gst: num(row[COLUMNS_PROJECTS[4]]),
          project_location: str(row[COLUMNS_PROJECTS[5]]) || null,
          start_date: toDateStr(row[COLUMNS_PROJECTS[6]]),
          status: projectStatus(row[COLUMNS_PROJECTS[7]]),
        })
        .select('id')
        .single()
      if (error) throw error
      projectCache.set(key, data.id)
      results.push({ sheet: SHEET_PROJECTS, row: rowNum, status: 'ok', message: `Created project "${projectName}"` })
    } catch (err) {
      results.push({ sheet: SHEET_PROJECTS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 2. Invoices ----
  const invoiceNumberMap = new Map<string, string>()
  for (const [i, row] of sheetRows(SHEET_INVOICES).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const invoiceNumber = str(row[COLUMNS_INVOICES[0]])
      const clientName = str(row[COLUMNS_INVOICES[1]])
      const projectName = str(row[COLUMNS_INVOICES[2]])
      const amount = num(row[COLUMNS_INVOICES[3]])
      if (!clientName) throw new Error('Client Name is required')
      if (amount === null) throw new Error('Amount is required')

      const clientId = await resolveClientId(clientName)
      const projectId = projectName ? await resolveProjectId(clientId, projectName) : null
      const invoiceDate = toDateStr(row[COLUMNS_INVOICES[6]])

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          client_id: clientId,
          project_id: projectId,
          invoice_number: invoiceNumber || null,
          amount,
          gst_pct: num(row[COLUMNS_INVOICES[4]]) ?? 0,
          tds_pct: num(row[COLUMNS_INVOICES[5]]) ?? 0,
          invoice_date: invoiceDate,
          due_days: num(row[COLUMNS_INVOICES[7]]),
          status: invoiceStatus(row[COLUMNS_INVOICES[8]], !!invoiceDate),
        })
        .select('id')
        .single()
      if (error) throw error

      if (invoiceNumber) invoiceNumberMap.set(invoiceNumber.toLowerCase(), data.id)
      results.push({
        sheet: SHEET_INVOICES,
        row: rowNum,
        status: 'ok',
        message: `Created invoice${invoiceNumber ? ` "${invoiceNumber}"` : ''} for ${clientName}`,
      })
    } catch (err) {
      results.push({ sheet: SHEET_INVOICES, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 3. Payments Received ----
  for (const [i, row] of sheetRows(SHEET_PAYMENTS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const invoiceNumber = str(row[COLUMNS_PAYMENTS[0]])
      const date = toDateStr(row[COLUMNS_PAYMENTS[1]])
      const amount = num(row[COLUMNS_PAYMENTS[2]])
      if (!invoiceNumber) throw new Error('Invoice Number is required')
      if (!date) throw new Error('Payment Date is required')
      if (amount === null) throw new Error('Amount is required')

      const invoiceId = invoiceNumberMap.get(invoiceNumber.toLowerCase())
      if (!invoiceId) throw new Error(`Invoice Number "${invoiceNumber}" not found on the Invoices sheet in this file`)

      const { error } = await supabase.from('invoice_payments').insert({
        invoice_id: invoiceId,
        date,
        amount,
        reference: str(row[COLUMNS_PAYMENTS[3]]) || null,
      })
      if (error) throw error
      results.push({ sheet: SHEET_PAYMENTS, row: rowNum, status: 'ok', message: `Recorded payment against invoice "${invoiceNumber}"` })
    } catch (err) {
      results.push({ sheet: SHEET_PAYMENTS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 4. Loans ----
  const loanRefMap = new Map<string, string>()
  for (const [i, row] of sheetRows(SHEET_LOANS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const reference = str(row[COLUMNS_LOANS[0]])
      const lender = str(row[COLUMNS_LOANS[1]])
      const principal = num(row[COLUMNS_LOANS[3]])
      const roi = num(row[COLUMNS_LOANS[4]])
      if (!lender) throw new Error('Lender Name is required')
      if (principal === null) throw new Error('Principal Amount is required')
      if (roi === null) throw new Error('Interest Rate % (ROI) is required')

      const { data, error } = await supabase
        .from('loans')
        .insert({
          lender,
          loan_type: loanTypeOf(row[COLUMNS_LOANS[2]]),
          principal,
          roi_pct: roi,
          date_taken: toDateStr(row[COLUMNS_LOANS[5]]),
          interest_payment_date: toDateStr(row[COLUMNS_LOANS[6]]),
          notes: str(row[COLUMNS_LOANS[7]]) || null,
        })
        .select('id')
        .single()
      if (error) throw error

      if (reference) loanRefMap.set(reference.toLowerCase(), data.id)
      results.push({ sheet: SHEET_LOANS, row: rowNum, status: 'ok', message: `Created loan from ${lender}` })
    } catch (err) {
      results.push({ sheet: SHEET_LOANS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 5. Loan Payments ----
  for (const [i, row] of sheetRows(SHEET_LOAN_PAYMENTS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const reference = str(row[COLUMNS_LOAN_PAYMENTS[0]])
      const date = toDateStr(row[COLUMNS_LOAN_PAYMENTS[1]])
      const interestPaid = num(row[COLUMNS_LOAN_PAYMENTS[2]]) ?? 0
      const principalPaid = num(row[COLUMNS_LOAN_PAYMENTS[3]]) ?? 0
      if (!reference) throw new Error('Loan Reference is required')
      if (!date) throw new Error('Payment Date is required')
      if (interestPaid === 0 && principalPaid === 0) throw new Error('Enter an Interest Paid or Principal Paid amount')

      const loanId = loanRefMap.get(reference.toLowerCase())
      if (!loanId) throw new Error(`Loan Reference "${reference}" not found on the Loans sheet in this file`)

      const { error } = await supabase.from('loan_payments').insert({
        loan_id: loanId,
        date,
        interest_paid: interestPaid,
        principal_paid: principalPaid,
        payment_mode: paymentModeOf(row[COLUMNS_LOAN_PAYMENTS[4]]),
        reference: str(row[COLUMNS_LOAN_PAYMENTS[5]]) || null,
      })
      if (error) throw error
      results.push({ sheet: SHEET_LOAN_PAYMENTS, row: rowNum, status: 'ok', message: `Recorded payment against loan "${reference}"` })
    } catch (err) {
      results.push({ sheet: SHEET_LOAN_PAYMENTS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}
