// Bank-account balances from opening balance + transfer movements only —
// this is a transfer log, not a full bank reconciliation (expenses/invoices/
// vendor bills paid outside a recorded transfer don't affect these numbers).

export interface TransferRow {
  from_account_id: string | null
  to_account_id: string | null
  amount: number
}

export function accountBalance(accountId: string, openingBalance: number, transfers: TransferRow[]): number {
  const inflow = transfers
    .filter((t) => t.to_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const outflow = transfers
    .filter((t) => t.from_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  return Number(openingBalance || 0) + inflow - outflow
}

/** Net cash on hand from transfers alone: bank→cash withdrawals increase it,
 * cash→bank deposits decrease it. No opening balance — cash starts at zero. */
export function cashBalance(transfers: TransferRow[]): number {
  const inflow = transfers
    .filter((t) => t.to_account_id === null)
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const outflow = transfers
    .filter((t) => t.from_account_id === null)
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  return inflow - outflow
}
