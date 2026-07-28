import { useBankAccounts } from '../../lib/queries/masters'
import { useTransfers } from '../../lib/queries/transfers'
import { fmt } from '../../lib/calc/format'
import { accountBalance, cashBalance } from '../../lib/calc/transfers'

export function AccountBalancesTable() {
  const { data: accounts } = useBankAccounts()
  const { data: transfers } = useTransfers(null)

  return (
    <details className="toggle-section">
      <summary>Balance by account</summary>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {(!accounts || accounts.length === 0) && (
              <tr>
                <td colSpan={2} className="empty-row">
                  Add bank accounts in the Admin tab first
                </td>
              </tr>
            )}
            {accounts?.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className="amt">{fmt(accountBalance(a.id, a.opening_balance, transfers ?? []))}</td>
              </tr>
            ))}
            <tr>
              <td>Cash</td>
              <td className="amt">{fmt(cashBalance(transfers ?? []))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  )
}
