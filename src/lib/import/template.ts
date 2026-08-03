import {
  SHEET_INSTRUCTIONS,
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
  EXAMPLE_ROW_PROJECTS,
  EXAMPLE_ROW_INVOICES,
  EXAMPLE_ROW_PAYMENTS,
  EXAMPLE_ROW_VENDOR_BILLS,
  EXAMPLE_ROW_VENDOR_BILL_PAYMENTS,
  EXAMPLE_ROW_LOANS,
  EXAMPLE_ROW_LOAN_PAYMENTS,
  INSTRUCTIONS_LINES,
} from './sheets'

/** Builds and downloads the blank/sample workbook admin fills in and re-uploads.
 * Write-side only (book_new/aoa_to_sheet/writeFile) — see runImport.ts for the
 * read-side CVE note, which doesn't apply here. */
export async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  const instructionsWs = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_LINES.map((line) => [line]))
  instructionsWs['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, instructionsWs, SHEET_INSTRUCTIONS)

  const sheets: [string, readonly string[], string[]][] = [
    [SHEET_PROJECTS, COLUMNS_PROJECTS, EXAMPLE_ROW_PROJECTS],
    [SHEET_INVOICES, COLUMNS_INVOICES, EXAMPLE_ROW_INVOICES],
    [SHEET_PAYMENTS, COLUMNS_PAYMENTS, EXAMPLE_ROW_PAYMENTS],
    [SHEET_VENDOR_BILLS, COLUMNS_VENDOR_BILLS, EXAMPLE_ROW_VENDOR_BILLS],
    [SHEET_VENDOR_BILL_PAYMENTS, COLUMNS_VENDOR_BILL_PAYMENTS, EXAMPLE_ROW_VENDOR_BILL_PAYMENTS],
    [SHEET_LOANS, COLUMNS_LOANS, EXAMPLE_ROW_LOANS],
    [SHEET_LOAN_PAYMENTS, COLUMNS_LOAN_PAYMENTS, EXAMPLE_ROW_LOAN_PAYMENTS],
  ]

  for (const [name, columns, exampleRow] of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([columns as string[], exampleRow])
    ws['!cols'] = columns.map((c) => ({ wch: Math.max(18, c.length) }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  XLSX.writeFile(wb, 'LIS_other_data_import_template.xlsx')
}
