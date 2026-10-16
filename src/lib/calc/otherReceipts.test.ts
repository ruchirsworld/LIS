import { describe, expect, it } from 'vitest'
import { OTHER_RECEIPT_KINDS, otherReceiptAccount, otherReceiptLabel } from './otherReceipts'

describe('other receipts', () => {
  it('credits a returned deposit to Security Deposits and everything else to Other Income', () => {
    expect(otherReceiptAccount('security_deposit')).toEqual({ code: '1080', name: 'Security Deposits' })
    for (const k of ['refund', 'interest', 'sale', 'other']) expect(otherReceiptAccount(k).code).toBe('4020')
  })

  it('has a plain label for every kind, and the five kinds the database accepts', () => {
    expect(OTHER_RECEIPT_KINDS.map((k) => k.value)).toEqual(['security_deposit', 'refund', 'interest', 'sale', 'other'])
    expect(otherReceiptLabel('interest')).toBe('Interest received')
    expect(otherReceiptLabel('unknown')).toBe('unknown')
  })
})
