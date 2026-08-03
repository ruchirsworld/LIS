import { SHEET_EXPENSES, COLUMNS_EXPENSES, EXAMPLE_ROW_EXPENSES, EXPENSES_INSTRUCTIONS_LINES } from './expensesSheet'

const SHEET_INSTRUCTIONS = 'Instructions'

/** Builds and downloads the standalone Expenses import file. Write-side only
 * (book_new/aoa_to_sheet/writeFile) — see runImport.ts for the read-side CVE
 * note, which doesn't apply here. */
export async function downloadExpensesImportTemplate(): Promise<void> {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  const instructionsWs = XLSX.utils.aoa_to_sheet(EXPENSES_INSTRUCTIONS_LINES.map((line) => [line]))
  instructionsWs['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, instructionsWs, SHEET_INSTRUCTIONS)

  const ws = XLSX.utils.aoa_to_sheet([COLUMNS_EXPENSES as unknown as string[], EXAMPLE_ROW_EXPENSES])
  ws['!cols'] = COLUMNS_EXPENSES.map((c) => ({ wch: Math.max(18, c.length) }))
  XLSX.utils.book_append_sheet(wb, ws, SHEET_EXPENSES)

  XLSX.writeFile(wb, 'LIS_expenses_import_template.xlsx')
}
