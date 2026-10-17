import {
  detectMapping,
  extractLines,
  findHeaderRow,
  parseCsv,
  parseStatementDate,
  serialDatesToText,
  type ColumnMapping,
  type StatementLine,
} from './bankStatement'
import type { NewStatementLine } from '../queries/recon'

/** Dates read from Excel become plain YYYY-MM-DD text. */
function plainCells(table: unknown[][]): unknown[][] {
  return table.map((row) => row.map((c) => (c instanceof Date ? parseStatementDate(c) ?? '' : c)))
}

export interface ReadStatement {
  rows: unknown[][]
  headerRow: number
  mapping: ColumnMapping
  lines: StatementLine[]
}

/** Reads a bank statement file (Excel or CSV): finds the table of transactions, guesses which column is which, and reads the lines. Throws a
 * plain-language message when the file cannot be read. */
export async function readStatementFile(file: File): Promise<ReadStatement> {
  let table: unknown[][] = []
  let at = -1
  if (/\.(csv|txt)$/i.test(file.name)) {
    table = parseCsv(await file.text())
    at = findHeaderRow(table)
  } else {
    const XLSX = await import('xlsx')
    // Dates stay as Excel serial numbers: a date object is shifted by the computer's time zone, which moves evening transactions to the next day.
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
    for (const name of wb.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
      const found = findHeaderRow(sheetRows)
      if (found >= 0) {
        table = sheetRows
        at = found
        break
      }
    }
  }
  if (at < 0) {
    throw new Error('I could not find the table of transactions in this file. It needs a Date column and either Withdrawal and Deposit columns, Debit and Credit columns, or one Amount column.')
  }
  const mapping = detectMapping(table[at].map((c) => String(c ?? '').trim()))
  table = serialDatesToText(plainCells(table), at)
  return { rows: table, headerRow: at, mapping, lines: extractLines(table, at, mapping) }
}

/** The lines as they are saved. Each gets a key built from what is on the line, plus a count for identical lines in the same file, so loading the
 * same statement again, or one that overlaps, adds only the lines that are new. */
export function toNewLines(lines: StatementLine[]): NewStatementLine[] {
  const seen = new Map<string, number>()
  return lines.map((l) => {
    const base = [l.date, l.description, l.reference, l.withdrawal, l.deposit, l.balance ?? ''].join('|')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return {
      line_date: l.date,
      description: l.description,
      reference: l.reference,
      debit: l.withdrawal,
      credit: l.deposit,
      balance: l.balance,
      dedupe_key: `${base}|${n}`,
    }
  })
}
