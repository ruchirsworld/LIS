// The items bought on a vendor bill. GST and TDS stay at the bill level; the items only explain what the
// bill value is made of, and when there are any, the bill value is their total.

import { parseINR } from './format'

/** One line as typed in the form (everything is text until it is saved). */
export interface BillItemDraft {
  name: string
  qty: string
  unit: string
  rate: string
  amount: string
}

export interface BillItemSave {
  name: string
  qty: number | null
  unit: string | null
  rate: number | null
  amount: number
  position: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const emptyItem = (): BillItemDraft => ({ name: '', qty: '', unit: '', rate: '', amount: '' })

/** Quantity times rate when both are given, otherwise the amount that was typed. */
export function itemAmount(i: BillItemDraft): number {
  const qty = parseINR(i.qty)
  const rate = parseINR(i.rate)
  if (qty > 0 && rate > 0) return round2(qty * rate)
  return round2(parseINR(i.amount))
}

/** Lines that have been started: a blank row left at the bottom of the table is ignored. */
export function usableItems(items: BillItemDraft[]): BillItemDraft[] {
  return items.filter((i) => i.name.trim() || itemAmount(i) > 0 || parseINR(i.qty) > 0 || parseINR(i.rate) > 0)
}

export function itemsTotal(items: BillItemDraft[]): number {
  return round2(usableItems(items).reduce((s, i) => s + itemAmount(i), 0))
}

/** The first problem with the items, in words, or null when they are fine to save. */
export function itemsProblem(items: BillItemDraft[]): string | null {
  const used = usableItems(items)
  for (let n = 0; n < used.length; n++) {
    if (!used[n].name.trim()) return `Item ${n + 1} needs a name.`
    if (itemAmount(used[n]) <= 0) return `Item ${n + 1} (${used[n].name.trim()}) needs an amount, or a quantity and a rate.`
  }
  return null
}

export function itemsToSave(items: BillItemDraft[]): BillItemSave[] {
  return usableItems(items).map((i, position) => ({
    name: i.name.trim(),
    qty: parseINR(i.qty) > 0 ? parseINR(i.qty) : null,
    unit: i.unit.trim() || null,
    rate: parseINR(i.rate) > 0 ? parseINR(i.rate) : null,
    amount: itemAmount(i),
    position,
  }))
}

/** A saved line, back into the form. */
export function itemToDraft(i: { name: string; qty: number | null; unit: string | null; rate: number | null; amount: number }): BillItemDraft {
  return {
    name: i.name,
    qty: i.qty != null ? String(i.qty) : '',
    unit: i.unit ?? '',
    rate: i.rate != null ? String(i.rate) : '',
    amount: String(i.amount),
  }
}

/** The items in one line of text, for downloads and lists. */
export function itemsSummary(items: { name: string; qty: number | null; unit: string | null; rate: number | null; amount: number }[]): string {
  return items
    .map((i) => `${i.name}${i.qty != null ? ` ${i.qty}${i.unit ? ` ${i.unit}` : ''}` : ''}${i.rate != null ? ` @ ${i.rate}` : ''} = ${i.amount}`)
    .join('; ')
}
