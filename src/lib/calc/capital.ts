// Ported 1:1 from LIS_v1.0.html (per-partner net capital position).

export interface CapitalTxRow {
  partner_id: string
  type: 'injection' | 'withdrawal'
  amount: number
}

export function partnerNet(partnerId: string, tx: CapitalTxRow[]): {
  injected: number
  withdrawn: number
  net: number
} {
  const forPartner = tx.filter((t) => t.partner_id === partnerId)
  const injected = forPartner
    .filter((t) => t.type === 'injection')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const withdrawn = forPartner
    .filter((t) => t.type === 'withdrawal')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  return { injected, withdrawn, net: injected - withdrawn }
}

export function capitalNetTotal(tx: CapitalTxRow[]): number {
  return tx.reduce((s, t) => s + (t.type === 'injection' ? Number(t.amount || 0) : -Number(t.amount || 0)), 0)
}
