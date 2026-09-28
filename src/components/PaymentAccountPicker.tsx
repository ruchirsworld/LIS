import { useEffect, type CSSProperties } from 'react'
import { SearchableSelect } from './SearchableSelect'
import { useBankAccounts } from '../lib/queries/masters'

// The one "Payment account" control for every place money leaves the company
// — expenses, vendor/procurement payments, reimbursements, loan repayments,
// wages, imprest. Same label, same order, same default everywhere.

export const CASH_ACCOUNT = 'cash'
// Not a real account: an employee paid out of pocket, so no cash or bank
// moves now and the firm owes them back.
export const REIMBURSE_ACCOUNT = 'reimburse'
// Not a real account either: paid from a supervisor's site float. Only offered
// when editing an expense that already used it.
export const IMPREST_ACCOUNT = 'imprest'

const BANK_ORDER = ['Kotak', 'CBI']
// A handful of accounts reads best as pills; past this a searchable
// dropdown scales better than a wall of buttons.
const MAX_PILLS = 6

interface AccountOption {
  id: string
  name: string
}

export function usePaymentAccountOptions({
  allowReimbursement = false,
  extra = [],
}: { allowReimbursement?: boolean; extra?: AccountOption[] } = {}) {
  const { data: bankAccounts } = useBankAccounts()
  // Defaulting waits for the bank list, or Kotak would lose to Cash.
  const ready = bankAccounts !== undefined
  const banks = [...(bankAccounts ?? [])].sort((a, b) => {
    const ai = BANK_ORDER.indexOf(a.name)
    const bi = BANK_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const options: AccountOption[] = [
    ...banks.map((b) => ({ id: b.id, name: b.name })),
    { id: CASH_ACCOUNT, name: 'Cash' },
    ...(allowReimbursement ? [{ id: REIMBURSE_ACCOUNT, name: 'Reimbursement' }] : []),
    ...extra,
  ]
  // Kotak is the main operating account; fall back to Cash if it isn't set up.
  const defaultId = options.find((o) => o.name === 'Kotak')?.id ?? CASH_ACCOUNT
  return { options, defaultId, ready }
}

/** What to store in a payment's `bank_account_id` for a picked account. */
export function bankAccountIdOf(accountId: string): string | null {
  return !accountId || accountId === CASH_ACCOUNT || accountId === REIMBURSE_ACCOUNT || accountId === IMPREST_ACCOUNT ? null : accountId
}

/** Cash, Bank or Reimbursement — for tables that record a payment mode. */
export function paymentModeOf(accountId: string): 'Cash' | 'Bank' | 'Reimbursement' {
  if (accountId === REIMBURSE_ACCOUNT) return 'Reimbursement'
  return !accountId || accountId === CASH_ACCOUNT ? 'Cash' : 'Bank'
}

export function PaymentAccountPicker({
  value,
  onChange,
  allowReimbursement = false,
  extra,
  label = 'Payment account',
  className,
  style,
}: {
  /** Picked account id; '' picks the default (Kotak, else Cash) once loaded. */
  value: string
  onChange: (accountId: string) => void
  /** Offer "Reimbursement" (an employee paid) — only where the payment
   * record can carry who to reimburse. */
  allowReimbursement?: boolean
  extra?: AccountOption[]
  /** Only change for money coming *in* ("Receiving account"). */
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const { options, defaultId, ready } = usePaymentAccountOptions({ allowReimbursement, extra })

  useEffect(() => {
    if (!value && ready) onChange(defaultId)
  }, [value, defaultId, ready, onChange])

  return (
    <div className={className ? `field ${className}` : 'field'} style={style}>
      <label>{label}</label>
      {options.length <= MAX_PILLS ? (
        <div className="pill-tabs">
          {options.map((a) => (
            <button
              key={a.id}
              type="button"
              className={value === a.id ? 'pill active' : 'pill'}
              onClick={() => onChange(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : (
        <SearchableSelect
          items={options}
          value={value}
          onChange={onChange}
          getId={(a) => a.id}
          getLabel={(a) => a.name}
          placeholder="— Select account —"
        />
      )}
    </div>
  )
}
