import { describe, expect, it } from 'vitest'
import { clusterPairs, type DuplicatePair } from './activityFeed'

const pair = (a: string, b: string, amount = 500): DuplicatePair => ({
  a_table: 'expenses', a_id: a, a_display_id: `E${a}`, a_kind: 'Expense', a_date: '2026-10-10', a_recorded_at: '2026-10-10T10:00:00Z', a_description: null, a_entered_by: 'u1',
  b_table: 'expenses', b_id: b, b_display_id: `E${b}`, b_kind: 'Expense', b_date: '2026-10-11', b_recorded_at: '2026-10-11T10:00:00Z', b_description: null, b_entered_by: 'u1',
  amount, dismissed: false,
})

describe('clusterPairs', () => {
  it('joins entries linked through others into one cluster', () => {
    const clusters = clusterPairs([pair('1', '2'), pair('2', '3'), pair('8', '9', 900)])
    expect(clusters).toHaveLength(2)
    expect(clusters[0].amount).toBe(900)
    expect(clusters[1].entries.map((e) => e.id).sort()).toEqual(['1', '2', '3'])
  })
  it('keeps the pairs of a cluster so a whole cluster can be dismissed', () => {
    const [c] = clusterPairs([pair('1', '2'), pair('2', '3')])
    expect(c.pairKeys).toHaveLength(2)
  })
  it('returns nothing for no pairs', () => {
    expect(clusterPairs([])).toEqual([])
  })
})
