import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from '../../lib/queries/admin'
import { fmt, parseINR } from '../../lib/calc/format'

export function BankAccountsSection() {
  const { data: accounts, isLoading } = useBankAccounts()
  const createAccount = useCreateBankAccount()
  const updateAccount = useUpdateBankAccount()
  const deleteAccount = useDeleteBankAccount()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setAccountNumber('')
    setOpeningBalance('0')
  }

  function startEdit(account: NonNullable<typeof accounts>[number]) {
    setEditingId(account.id)
    setName(account.name)
    setAccountNumber(account.account_number ?? '')
    setOpeningBalance(String(account.opening_balance ?? 0))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Account name is required.')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        name: name.trim(),
        account_number: accountNumber.trim() || null,
        opening_balance: parseINR(openingBalance),
      }
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, patch })
      } else {
        await createAccount.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save bank account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Bank accounts</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Account name</label>
          <input
            type="text"
            required
            placeholder="e.g. HDFC Current Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Account number (optional)</label>
          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </div>

        <div className="field">
          <label>Opening balance (₹)</label>
          <CurrencyInput value={openingBalance} onValueChange={setOpeningBalance} />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add account'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Account number</th>
              <th style={{ textAlign: 'right' }}>Opening balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!accounts || accounts.length === 0) && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No bank accounts yet — add your first one above
                </td>
              </tr>
            )}
            {accounts?.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.account_number ?? '—'}</td>
                <td className="amt">{fmt(a.opening_balance)}</td>
                <td>
                  <button type="button" className="pay-btn" onClick={() => startEdit(a)}>
                    Edit
                  </button>
                  <button type="button" className="btn danger-link" onClick={() => deleteAccount.mutate(a.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
