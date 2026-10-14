// Reads a bank statement (Excel or CSV) into plain lines: date, description,
// money in, money out. Banks lay these files out differently, so the columns are
// found by their headings, and the mapping can be corrected by the user.

export interface StatementLine {
  /** Position in the file, so a line can be pointed to. */
  row: number
  date: string
  description: string
  reference: string
  deposit: number
  withdrawal: number
  balance: number | null
}

export interface ColumnMapping {
  date: number | null
  description: number | null
  reference: number | null
  withdrawal: number | null
  deposit: number | null
  /** One column holding every amount, with the direction given by a sign or a Dr/Cr column. */
  amount: number | null
  drcr: number | null
  balance: number | null
}

const text = (v: unknown) => String(v ?? '').trim()

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const iso = (y: number, m: number, d: number): string | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const year = y < 100 ? 2000 + y : y
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Day-first, as Indian banks print dates. Returns YYYY-MM-DD, or null if it is not a date. */
export function parseStatementDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // A date read from Excel can sit a few hours off midnight; noon UTC lands on the right day either way.
    const d = new Date(v.getTime() + 12 * 3600 * 1000)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  if (typeof v === 'number') {
    if (v < 30000 || v > 80000) return null
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const s = text(v)
  if (!s) return null
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/)
  if (m) return iso(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ,]*(\d{2,4})/)
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase())
    return mi === -1 ? null : iso(+m[3], mi + 1, +m[1])
  }
  return null
}

// ── Money ────────────────────────────────────────────────────────────────────

export interface Money {
  value: number
  /** 'dr' or 'cr' when the text itself says so ("500.00 Dr"), else null. */
  side: 'dr' | 'cr' | null
}

/** "1,23,456.78", "₹ 500", "(500.00)", "-500", "500.00 Cr". Blank or text gives null. */
export function parseMoney(v: unknown): Money | null {
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v, side: null } : null
  let s = text(v)
  if (!s) return null
  let side: Money['side'] = null
  const tail = s.match(/\s*(dr|cr|debit|credit)\.?$/i)
  if (tail) {
    side = /^d/i.test(tail[1]) ? 'dr' : 'cr'
    s = s.slice(0, tail.index)
  }
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[₹,\s]|rs\.?|inr/gi, '')
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return { value: negative ? -n : n, side }
}

// ── Finding the table ────────────────────────────────────────────────────────

const DATE_HEAD = /^(txn|transaction|tran|trans)\.?\s*(date|dt)$|^date$|^posting\s*date$/i
const VALUE_DATE_HEAD = /value\s*(date|dt)/i
const MONEY_HEAD = /withdraw|debit|\bdr\b|deposit|credit|\bcr\b|amount/i

/** Index of the heading row (the first row with a date column and a money column), or -1. */
export function findHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 60)
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map(text)
    const hasDate = cells.some((c) => DATE_HEAD.test(c) || VALUE_DATE_HEAD.test(c))
    const hasMoney = cells.some((c) => MONEY_HEAD.test(c))
    if (hasDate && hasMoney) return i
  }
  return -1
}

/** Best guess at which column is which, from the headings. */
export function detectMapping(headers: string[]): ColumnMapping {
  const used = new Set<number>()
  const pick = (...patterns: RegExp[]): number | null => {
    for (const re of patterns) {
      const i = headers.findIndex((h, idx) => !used.has(idx) && re.test(h))
      if (i !== -1) {
        used.add(i)
        return i
      }
    }
    return null
  }
  const date = pick(DATE_HEAD, VALUE_DATE_HEAD)
  // A combined Dr/Cr column must be claimed before the Debit and Credit patterns can mistake it for one of them.
  const drcr = pick(/dr\s*\/\s*cr|cr\s*\/\s*dr|^type$|debit\s*\/\s*credit/i)
  const withdrawal = pick(/withdraw|paid\s*out|money\s*out/i, /\bdebit\b|\bdr\b/i)
  const deposit = pick(/deposit|paid\s*in|money\s*in/i, /\bcredit\b|\bcr\b/i)
  const balance = pick(/balance|\bbal\b/i)
  const amount = withdrawal === null && deposit === null ? pick(/^(txn|transaction)?\s*amount/i, /amount/i) : null
  const reference = pick(/chq|cheque|ref|utr|instrument/i)
  const description = pick(/narration|description|particulars|remarks|details/i)
  return { date, description, reference, withdrawal, deposit, amount, drcr, balance }
}

/** The lines of the statement, using the mapping. Rows without a valid date are skipped. */
export function extractLines(rows: unknown[][], headerRow: number, map: ColumnMapping): StatementLine[] {
  if (map.date === null) return []
  const out: StatementLine[] = []
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    const date = parseStatementDate(row[map.date])
    if (!date) continue

    let deposit = 0
    let withdrawal = 0
    if (map.withdrawal !== null || map.deposit !== null) {
      withdrawal = Math.abs(parseMoney(map.withdrawal === null ? '' : row[map.withdrawal])?.value ?? 0)
      deposit = Math.abs(parseMoney(map.deposit === null ? '' : row[map.deposit])?.value ?? 0)
    } else if (map.amount !== null) {
      const money = parseMoney(row[map.amount])
      if (money) {
        const flag = map.drcr === null ? '' : text(row[map.drcr])
        const isDebit = /^(d|dr|debit|w)/i.test(flag) || money.side === 'dr' || (!flag && !money.side && money.value < 0)
        const isCredit = /^(c|cr|credit|dep)/i.test(flag) || money.side === 'cr'
        if (isDebit && !isCredit) withdrawal = Math.abs(money.value)
        else deposit = Math.abs(money.value)
      }
    }
    if (deposit === 0 && withdrawal === 0) continue

    const bal = map.balance === null ? null : parseMoney(row[map.balance])
    out.push({
      row: r + 1,
      date,
      description: map.description === null ? '' : text(row[map.description]),
      reference: map.reference === null ? '' : text(row[map.reference]),
      deposit: Math.round(deposit * 100) / 100,
      withdrawal: Math.round(withdrawal * 100) / 100,
      balance: bal ? (bal.side === 'dr' ? -Math.abs(bal.value) : bal.value) : null,
    })
  }
  return out
}

/** The balance after the last transaction, whichever way round the file is sorted. */
export function closingBalance(lines: StatementLine[]): { date: string; balance: number } | null {
  const withBalance = lines.filter((l) => l.balance !== null)
  if (withBalance.length === 0) return null
  const first = withBalance[0]
  const last = withBalance[withBalance.length - 1]
  const pick = first.date > last.date ? first : last
  return { date: pick.date, balance: pick.balance as number }
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** A small CSV reader. Dates stay as text, so day-first dates are never read as month-first. */
export function parseCsv(textContent: string): string[][] {
  const clean = textContent.replace(/^﻿/, '')
  const sample = clean.split(/\r?\n/).slice(0, 8).join('\n')
  const count = (ch: string) => (sample.match(new RegExp(ch === '\t' ? '\\t' : `\\${ch}`, 'g')) ?? []).length
  const delimiter = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0]

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}
