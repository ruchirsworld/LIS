import { describe, expect, it } from 'vitest'
import { emptyItem, itemAmount, itemsProblem, itemsSummary, itemsToSave, itemsTotal, usableItems, type BillItemDraft } from './billItems'

const item = (over: Partial<BillItemDraft>): BillItemDraft => ({ ...emptyItem(), ...over })

describe('bill items', () => {
  it('works out a line from quantity and rate, or takes the typed amount', () => {
    expect(itemAmount(item({ qty: '20', rate: '350.50' }))).toBe(7010)
    expect(itemAmount(item({ amount: '1,250' }))).toBe(1250)
    // quantity and rate win over a stale typed amount
    expect(itemAmount(item({ qty: '2', rate: '10', amount: '999' }))).toBe(20)
  })

  it('ignores blank rows and adds up the rest', () => {
    const rows = [item({ name: 'Areca palm', qty: '20', rate: '350' }), item({ name: 'Cocopeat', amount: '1200' }), emptyItem()]
    expect(usableItems(rows)).toHaveLength(2)
    expect(itemsTotal(rows)).toBe(8200)
  })

  it('names the first problem line', () => {
    expect(itemsProblem([item({ amount: '500' })])).toBe('Item 1 needs a name.')
    expect(itemsProblem([item({ name: 'Pots' })])).toBe('Item 1 (Pots) needs an amount, or a quantity and a rate.')
    expect(itemsProblem([item({ name: 'Pots', amount: '500' }), emptyItem()])).toBeNull()
    expect(itemsProblem([])).toBeNull()
  })

  it('prepares lines to save, in order, with empty fields as null', () => {
    expect(itemsToSave([item({ name: ' Palm ', qty: '3', unit: 'Nos', rate: '100' }), item({ name: 'Delivery', amount: '250' })])).toEqual([
      { name: 'Palm', qty: 3, unit: 'Nos', rate: 100, amount: 300, position: 0 },
      { name: 'Delivery', qty: null, unit: null, rate: null, amount: 250, position: 1 },
    ])
  })

  it('writes items in one line for downloads', () => {
    expect(
      itemsSummary([
        { name: 'Palm', qty: 3, unit: 'Nos', rate: 100, amount: 300 },
        { name: 'Delivery', qty: null, unit: null, rate: null, amount: 250 },
      ])
    ).toBe('Palm 3 Nos @ 100 = 300; Delivery = 250')
  })
})
