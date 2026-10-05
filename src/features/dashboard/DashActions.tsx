import { useEffect, useRef, useState } from 'react'
import { useUpdateExpense } from '../../lib/queries/expenses'
import { useCycleInvoiceStatus } from '../../lib/queries/invoices'
import { getErrorMessage } from '../../lib/errors'
import { fmt } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type Expense = Database['public']['Tables']['expenses']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']

/** A button that asks for a second click before doing anything — for actions
 * that post to the books or can't be undone from the dashboard. Disarms
 * itself after a few seconds so a stray first click isn't left primed. */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  danger,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function click(e: React.MouseEvent) {
    // The row behind is a link to the full page — a button press is not.
    e.stopPropagation()
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 4000)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setArmed(false)
    onConfirm()
  }

  return (
    <button
      type="button"
      className={armed ? 'pay-btn dash-armed' : danger ? 'btn danger-link' : 'pay-btn'}
      disabled={disabled}
      onClick={click}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

/** Approve / Reject a supervisor's pending project claim, same effect as on
 * the Approvals page: approving settles it from the supervisor's site imprest. */
export function ClaimActions({ expense }: { expense: Expense }) {
  const updateExpense = useUpdateExpense()
  const [error, setError] = useState<string | null>(null)

  async function run(patch: Database['public']['Tables']['expenses']['Update'], failure: string) {
    setError(null)
    try {
      await updateExpense.mutateAsync({ id: expense.id, patch })
    } catch (err) {
      setError(getErrorMessage(err, failure))
    }
  }

  return (
    <div>
      <div className="dash-row-actions" onClick={(e) => e.stopPropagation()}>
        <ConfirmButton
          label="Approve"
          confirmLabel={`Confirm ${fmt(expense.amount)}`}
          disabled={updateExpense.isPending}
          onConfirm={() =>
            run(
              { status: 'approved', paid_from_imprest: true, reimbursable: false, payment_mode: null, bank_account_id: null },
              'Could not approve this claim.'
            )
          }
        />
        <ConfirmButton
          label="Reject"
          confirmLabel="Confirm reject"
          danger
          disabled={updateExpense.isPending}
          onConfirm={() => run({ status: 'rejected' }, 'Could not reject this claim.')}
        />
      </div>
      {error && <div className="dash-row-error">{error}</div>}
    </div>
  )
}

/** Marks a draft invoice as sent (stamping today's date if it has none yet),
 * which also posts it to the books. */
export function SendInvoiceAction({ invoice }: { invoice: Invoice }) {
  const cycleStatus = useCycleInvoiceStatus()
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    try {
      await cycleStatus.mutateAsync({ id: invoice.id, status: invoice.status, invoiceDate: invoice.invoice_date })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send this invoice.'))
    }
  }

  return (
    <div>
      <div className="dash-row-actions" onClick={(e) => e.stopPropagation()}>
        <ConfirmButton label="Send" confirmLabel="Confirm send" disabled={cycleStatus.isPending} onConfirm={send} />
      </div>
      {error && <div className="dash-row-error">{error}</div>}
    </div>
  )
}
