import { describe, expect, it } from 'vitest'
import { closingBalance, detectMapping, extractLines, findHeaderRow, parseCsv, parseMoney, parseStatementDate } from './bankStatement'

describe('dates are read day-first', () => {
  it('handles the formats banks use', () => {
    expect(parseStatementDate('02/10/2026')).toBe('2026-10-02')
    expect(parseStatementDate('02-10-26')).toBe('2026-10-02')
    expect(parseStatementDate('02-Oct-2026')).toBe('2026-10-02')
    expect(parseStatementDate('2 Oct 26')).toBe('2026-10-02')
    expect(parseStatementDate('2026-10-02')).toBe('2026-10-02')
    expect(parseStatementDate('02.10.2026')).toBe('2026-10-02')
  })
  it('reads Excel dates and serial numbers', () => {
    expect(parseStatementDate(new Date(Date.UTC(2026, 9, 2, 0, 0, 0)))).toBe('2026-10-02')
    expect(parseStatementDate(new Date(2026, 9, 2, 0, 0, 0))).toBe('2026-10-02')
    expect(parseStatementDate(46297)).toBe('2026-10-02')
  })
  it('does not mistake other text for a date', () => {
    expect(parseStatementDate('Opening Balance')).toBeNull()
    expect(parseStatementDate('')).toBeNull()
    expect(parseStatementDate(12)).toBeNull()
  })
})

describe('money', () => {
  it('reads Indian formats', () => {
    expect(parseMoney('1,23,456.78')?.value).toBe(123456.78)
    expect(parseMoney('₹ 500')?.value).toBe(500)
    expect(parseMoney('(500.00)')?.value).toBe(-500)
    expect(parseMoney('-250.5')?.value).toBe(-250.5)
    expect(parseMoney('1,500.00 Dr')).toEqual({ value: 1500, side: 'dr' })
    expect(parseMoney('900.00 CR')).toEqual({ value: 900, side: 'cr' })
  })
  it('treats blanks and words as no amount', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('NEFT')).toBeNull()
  })
})

const hdfc: unknown[][] = [
  ['HDFC BANK LTD', '', '', '', '', '', ''],
  ['Account No: XXXX1234', '', '', '', '', '', ''],
  ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
  ['02/10/26', 'NEFT CR-MKC INFRA-RA12', 'N2810001', '02/10/26', '', '3,00,000.00', '3,00,000.00'],
  ['05/10/26', 'CHQ PAID-SHREE STEEL', '000123', '05/10/26', '1,18,000.00', '', '1,82,000.00'],
  ['09/10/26', 'BANK CHARGES', '', '09/10/26', '118.00', '', '1,81,882.00'],
]

describe('a statement table is found and read', () => {
  it('finds the heading row below the bank letterhead', () => {
    expect(findHeaderRow(hdfc)).toBe(2)
  })

  it('works with separate withdrawal and deposit columns (HDFC style)', () => {
    const map = detectMapping(hdfc[2].map(String))
    expect(map).toMatchObject({ date: 0, description: 1, reference: 2, withdrawal: 4, deposit: 5, balance: 6 })
    const lines = extractLines(hdfc, 2, map)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ date: '2026-10-02', deposit: 300000, withdrawal: 0 })
    expect(lines[1]).toMatchObject({ date: '2026-10-05', deposit: 0, withdrawal: 118000 })
    expect(closingBalance(lines)).toEqual({ date: '2026-10-09', balance: 181882 })
  })

  it('works with Debit / Credit headings (SBI style)', () => {
    const rows = [
      ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance'],
      ['02 Oct 2026', '02 Oct 2026', 'TRANSFER FROM CLIENT', 'X1', '', '50000', '50000'],
      ['03 Oct 2026', '03 Oct 2026', 'TO SUPPLIER', 'X2', '20000', '', '30000'],
    ]
    const lines = extractLines(rows, 0, detectMapping(rows[0].map(String)))
    expect(lines.map((l) => [l.deposit, l.withdrawal])).toEqual([[50000, 0], [0, 20000]])
  })

  it('works with one amount column and a Dr/Cr flag', () => {
    const rows = [
      ['Tran Date', 'Particulars', 'Amount', 'Dr/Cr', 'Balance'],
      ['02-10-2026', 'RECEIPT', '10,000.00', 'CR', '10,000.00'],
      ['04-10-2026', 'PAYMENT', '2,500.00', 'DR', '7,500.00'],
    ]
    const map = detectMapping(rows[0].map(String))
    expect(map.amount).toBe(2)
    expect(map.drcr).toBe(3)
    const lines = extractLines(rows, 0, map)
    expect(lines.map((l) => [l.deposit, l.withdrawal])).toEqual([[10000, 0], [0, 2500]])
  })

  it('works with a signed amount column', () => {
    const rows = [
      ['Date', 'Description', 'Amount'],
      ['01/10/2026', 'IN', '700'],
      ['02/10/2026', 'OUT', '-300'],
    ]
    const lines = extractLines(rows, 0, detectMapping(rows[0].map(String)))
    expect(lines.map((l) => [l.deposit, l.withdrawal])).toEqual([[700, 0], [0, 300]])
  })

  it('skips opening/closing lines and reads a newest-first file correctly', () => {
    const rows = [
      ['Date', 'Narration', 'Withdrawal', 'Deposit', 'Balance'],
      ['Closing Balance', '', '', '', '500'],
      ['10/10/2026', 'B', '100', '', '500'],
      ['09/10/2026', 'A', '', '600', '600'],
    ]
    const lines = extractLines(rows, 0, detectMapping(rows[0].map(String)))
    expect(lines).toHaveLength(2)
    expect(closingBalance(lines)).toEqual({ date: '2026-10-10', balance: 500 })
  })
})

describe('csv', () => {
  it('keeps day-first dates as text and handles quotes', () => {
    const rows = parseCsv('Date,Narration,Withdrawal,Deposit\r\n02/10/2026,"PAYMENT, SHREE STEEL",1000,\r\n03/10/2026,"Said ""hello""",,500\r\n')
    expect(rows).toEqual([
      ['Date', 'Narration', 'Withdrawal', 'Deposit'],
      ['02/10/2026', 'PAYMENT, SHREE STEEL', '1000', ''],
      ['03/10/2026', 'Said "hello"', '', '500'],
    ])
  })
  it('detects semicolon and tab separated files', () => {
    expect(parseCsv('a;b;c\n1;2;3')[1]).toEqual(['1', '2', '3'])
    expect(parseCsv('a\tb\tc\n1\t2\t3')[1]).toEqual(['1', '2', '3'])
  })
})
