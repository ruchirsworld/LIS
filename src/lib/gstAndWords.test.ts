import { describe, expect, it } from 'vitest'
import { cleanGstin, isValidGstin, isValidPan, panOfGstin, stateCodeOfGstin } from './gst'
import { amountInWords } from './calc/words'

describe('GSTIN and PAN checks', () => {
  it('accepts the company GSTIN and reads its parts', () => {
    expect(isValidGstin('07AAJFL1554B1ZN')).toBe(true)
    expect(panOfGstin('07AAJFL1554B1ZN')).toBe('AAJFL1554B')
    expect(stateCodeOfGstin('07AAJFL1554B1ZN')).toBe('07')
  })

  it('tolerates spaces and lower case', () => {
    expect(cleanGstin(' 07aajfl1554b1zn ')).toBe('07AAJFL1554B1ZN')
  })

  it('rejects malformed numbers', () => {
    expect(isValidGstin('07AAJFL1554B1Z')).toBe(false)
    expect(isValidGstin('')).toBe(false)
    expect(isValidPan('AAJFL1554B')).toBe(true)
    expect(isValidPan('AAJFL1554')).toBe(false)
  })
})

describe('amount in words (Indian numbering)', () => {
  it('reads lakhs and crores', () => {
    expect(amountInWords(116000)).toBe('Rupees One Lakh Sixteen Thousand Only')
    expect(amountInWords(12500000)).toBe('Rupees One Crore Twenty Five Lakh Only')
  })

  it('includes paise', () => {
    expect(amountInWords(1.5)).toMatch(/Paise Fifty/)
  })
})
