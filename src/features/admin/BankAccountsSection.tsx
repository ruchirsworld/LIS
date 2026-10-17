import { useState, type FormEvent } from 'react'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { confirmAction } from '../../lib/feedback'
import { RecordDetails } from '../reports/RecordDetailModal'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useBankAccounts } from '../../lib/queries/masters'
import { useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from '../../lib/queries/admin'
import { fmt, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'

export function BankAccountsSection() {
  const { data: accounts, isLoading } = useBankAccounts()
  const createAccount = useCreateBankAccount()
  const updateAccount = useUpdateBankAccount()
  const deleteAccount = useDeleteBankAccount()
  const openRows = useOpenRows()

  async function removeAccount(a: NonNullable<typeof accounts>[number]) {
    const ok = await confirmAction({
      title: 'Delete bank account',
      message: `Delete ${a.name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteAccount.mutate(a.id)
  }

  const [search, setSearch] = useState('')
  const searched = search ? accounts?.filter((r) => matchesSearch(search, Object.values(r))) : accounts
  const { sorted: sortedAccounts, sortKey, direction, toggleSort } = useSort(searched, {
    name: (a) => a.name,
    accountNumber: (a) => a.account_number,
    openingBalance: (a) => a.opening_balance,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedAccounts, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Bank accounts',
      columns: ['Name', 'Account number', 'Opening balance'],
      rows: (sortedAccounts ?? []).map((a) => [a.name, a.account_number ?? '', a.opening_balance]),
    },
  ]

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
      setFormError(getErrorMessage(err, 'Could not save bank account.'))
    } finally {
      setSubmitting(false)
    }
  }

  const formBody = (
    <>
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
    </>
  )

  return (
    <details className="toggle-section">
      <summary>Bank accounts</summary>

      {!editingId && formBody}
      {editingId && (
        <Modal title="Edit bank account" onClose={resetForm}>
          {formBody}
        </Modal>
      )}

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Bank accounts" sections={exportSections} range={null} iconOnly style={{ marginTop: 0 }} />
      </div>
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <SortableTh label="Name" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Account number" sortKey="accountNumber" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Opening balance" sortKey="openingBalance" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedAccounts || sortedAccounts.length === 0) && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No bank accounts yet — add your first one above
                </td>
              </tr>
            )}
            {pageRows?.map((a) => (
              <RecordRow
                key={a.id}
                expanded={openRows.isOpen(a.id)}
                onToggle={() => openRows.toggle(a.id)}
                colSpan={5}
                details={<RecordDetails sourceTable="bank_accounts" sourceId={a.id} />}
                onEdit={() => startEdit(a)}
                onDelete={() => void removeAccount(a)}
              >
                <td>{a.name}</td>
                <td>{a.account_number ?? '—'}</td>
                <td className="amt">{fmt(a.opening_balance)}</td>
              </RecordRow>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
