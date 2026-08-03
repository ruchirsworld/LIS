import { supabase } from '../supabase'
import { str, num, toDateStr, isBlankRow, paymentModeOf } from './helpers'
import {
  SHEET_PROJECTS,
  SHEET_INVOICES,
  SHEET_PAYMENTS,
  SHEET_VENDOR_BILLS,
  SHEET_VENDOR_BILL_PAYMENTS,
  SHEET_LOANS,
  SHEET_LOAN_PAYMENTS,
  COLUMNS_PROJECTS,
  COLUMNS_INVOICES,
  COLUMNS_PAYMENTS,
  COLUMNS_VENDOR_BILLS,
  COLUMNS_VENDOR_BILL_PAYMENTS,
  COLUMNS_LOANS,
  COLUMNS_LOAN_PAYMENTS,
} from './sheets'

export interface ImportResultRow {
  sheet: string
  row: number
  status: 'ok' | 'error' | 'skipped'
  message: string
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

function vendorBillPaymentModeOf(v: unknown): 'UPI' | 'NEFT' | 'Cash' | null {
  const s = str(v)
  return s === 'UPI' || s === 'NEFT' || s === 'Cash' ? s : null
}

/** Parses the uploaded workbook and writes every row it can, sheet by sheet
 * (Projects → Invoices → Payments Received → Vendor Bills → Vendor Bill
 * Payments → Loans → Loan Payments), so later sheets can resolve the
 * Clients/Projects/Vendors/Invoices/Bills earlier sheets just created. One
 * bad row is reported and skipped, not fatal to the rest of the file.
 * Expenses have their own separate import file — see runExpensesImport.ts. */
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
  const vendorCache = new Map<string, string>()

  const { data: existingClients, error: clientsErr } = await supabase.from('clients').select('id, name')
  if (clientsErr) throw clientsErr
  existingClients?.forEach((c) => clientCache.set(c.name.trim().toLowerCase(), c.id))

  const { data: existingProjects, error: projectsErr } = await supabase.from('projects').select('id, name, client_id')
  if (projectsErr) throw projectsErr
  existingProjects?.forEach((p) => projectCache.set(`${p.client_id}::${p.name.trim().toLowerCase()}`, p.id))

  const { data: existingVendors, error: vendorsErr } = await supabase.from('vendors').select('id, name')
  if (vendorsErr) throw vendorsErr
  existingVendors?.forEach((v) => vendorCache.set(v.name.trim().toLowerCase(), v.id))

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

  async function resolveVendorId(name: string): Promise<string> {
    const key = name.trim().toLowerCase()
    const cached = vendorCache.get(key)
    if (cached) return cached
    const { data, error } = await supabase.from('vendors').insert({ name: name.trim() }).select('id').single()
    if (error) throw error
    vendorCache.set(key, data.id)
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
          cost_center: null,
          budget: null,
          value_ex_gst: num(row[COLUMNS_PROJECTS[2]]),
          project_location: null,
          start_date: toDateStr(row[COLUMNS_PROJECTS[3]]),
          status: projectStatus(undefined),
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
      const invoiceDate = toDateStr(row[COLUMNS_INVOICES[5]])

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          client_id: clientId,
          project_id: projectId,
          invoice_number: invoiceNumber || null,
          amount,
          gst_pct: num(row[COLUMNS_INVOICES[4]]) ?? 0,
          tds_pct: 0,
          invoice_date: invoiceDate,
          due_days: null,
          status: invoiceStatus(undefined, !!invoiceDate),
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

  // ---- 4. Vendor Bills ----
  const billRefMap = new Map<string, string>()
  for (const [i, row] of sheetRows(SHEET_VENDOR_BILLS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const reference = str(row[COLUMNS_VENDOR_BILLS[0]])
      const vendorName = str(row[COLUMNS_VENDOR_BILLS[1]])
      const amount = num(row[COLUMNS_VENDOR_BILLS[5]])
      if (!vendorName) throw new Error('Vendor Name is required')
      if (amount === null) throw new Error('Bill Value ex GST is required')

      const vendorId = await resolveVendorId(vendorName)
      const clientName = str(row[COLUMNS_VENDOR_BILLS[3]])
      const projectName = str(row[COLUMNS_VENDOR_BILLS[4]])
      const clientId = clientName ? await resolveClientId(clientName) : null
      const projectId = clientId && projectName ? await resolveProjectId(clientId, projectName) : null

      const { data, error } = await supabase
        .from('vendor_bills')
        .insert({
          vendor_id: vendorId,
          date: toDateStr(row[COLUMNS_VENDOR_BILLS[2]]),
          description: null,
          client_id: clientId,
          project_id: projectId,
          amount,
          gst_pct: num(row[COLUMNS_VENDOR_BILLS[6]]) ?? 0,
        })
        .select('id')
        .single()
      if (error) throw error

      if (reference) billRefMap.set(reference.toLowerCase(), data.id)
      results.push({ sheet: SHEET_VENDOR_BILLS, row: rowNum, status: 'ok', message: `Created bill from ${vendorName}` })
    } catch (err) {
      results.push({ sheet: SHEET_VENDOR_BILLS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 5. Vendor Bill Payments ----
  for (const [i, row] of sheetRows(SHEET_VENDOR_BILL_PAYMENTS).entries()) {
    const rowNum = i + 2
    if (isBlankRow(row)) continue
    try {
      const reference = str(row[COLUMNS_VENDOR_BILL_PAYMENTS[0]])
      const date = toDateStr(row[COLUMNS_VENDOR_BILL_PAYMENTS[1]])
      const amount = num(row[COLUMNS_VENDOR_BILL_PAYMENTS[2]])
      if (!reference) throw new Error('Bill Reference is required')
      if (!date) throw new Error('Payment Date is required')
      if (amount === null) throw new Error('Amount is required')

      const billId = billRefMap.get(reference.toLowerCase())
      if (!billId) throw new Error(`Bill Reference "${reference}" not found on the Vendor Bills sheet in this file`)

      const { error } = await supabase.from('vendor_bill_payments').insert({
        bill_id: billId,
        date,
        amount,
        payment_mode: vendorBillPaymentModeOf(row[COLUMNS_VENDOR_BILL_PAYMENTS[3]]),
        reference: str(row[COLUMNS_VENDOR_BILL_PAYMENTS[4]]) || null,
      })
      if (error) throw error
      results.push({ sheet: SHEET_VENDOR_BILL_PAYMENTS, row: rowNum, status: 'ok', message: `Recorded payment against bill "${reference}"` })
    } catch (err) {
      results.push({ sheet: SHEET_VENDOR_BILL_PAYMENTS, row: rowNum, status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- 6. Loans ----
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
          notes: str(row[COLUMNS_LOANS[6]]) || null,
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

  // ---- 7. Loan Payments ----
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
