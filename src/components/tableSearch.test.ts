import { describe, expect, it } from 'vitest'
import { matchesSearch } from './TableSearch'

describe('searching records', () => {
  const row = ['Exp/488', 'Ashwani Kumar, tea', 1440, '2026-10-01', 'Kotak']

  it('matches an empty search with every row', () => {
    expect(matchesSearch('', row)).toBe(true)
    expect(matchesSearch('   ', row)).toBe(true)
  })

  it('finds by ID, words from the description, a name, in any case', () => {
    expect(matchesSearch('exp/488', row)).toBe(true)
    expect(matchesSearch('TEA', row)).toBe(true)
    expect(matchesSearch('kotak', row)).toBe(true)
  })

  it('needs every word to be present, in any order', () => {
    expect(matchesSearch('kumar tea', row)).toBe(true)
    expect(matchesSearch('tea cbi', row)).toBe(false)
  })

  it('finds an amount with or without commas and the rupee sign', () => {
    expect(matchesSearch('1440', row)).toBe(true)
    expect(matchesSearch('₹1,440', row)).toBe(true)
    expect(matchesSearch('1440.00', row)).toBe(true)
    expect(matchesSearch('1441', row)).toBe(false)
  })

  it('finds a date as written on screen or as stored', () => {
    expect(matchesSearch('01 oct 2026', row)).toBe(true)
    expect(matchesSearch('2026-10-01', row)).toBe(true)
    expect(matchesSearch('oct', row)).toBe(true)
  })

  it('ignores empty values', () => {
    expect(matchesSearch('x', [null, undefined, ''])).toBe(false)
  })
})
