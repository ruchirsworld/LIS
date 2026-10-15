import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { fmt2, fmtDate } from '../../lib/calc/format'
import type { Database } from '../../types/database'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { ExpenseReimbursementForm } from '../expenses/ExpenseReimbursementForm'
import { VendorBillPaymentForm } from '../purchases/VendorBillPaymentForm'
import { EditInvoicePaymentFields } from '../invoices/InvoicePaymentForm'
import { LoanForm } from '../loans/LoanForm'

type Tables = Database['public']['Tables']

/** The kinds of entry that can be changed here, without leaving Bank reconciliation. */
const EDITABLE = ['expenses', 'expense_reimbursements', 'vendor_bill_payments', 'invoice_payments', 'loans'] as const
type Editable = (typeof EDITABLE)[number]
const isEditable = (t: string | null | undefined): t is Editable => !!t && (EDITABLE as readonly string[]).includes(t)

const NAME: Record<string, string> = {
  expenses: 'expense',
  expense_reimbursements: 'reimbursement',
  vendor_bill_payments: 'vendor payment',
  invoice_payments: 'client receipt',
  loans: 'loan',
}

/** Change an entry of the books from inside Bank reconciliation. Saving re-posts the entry, so its tick is taken off
 * and it is matched again against the statement. Entry kinds with no form here (transfers, capital, advances and loan
 * repayments) are changed in their own screen. */
export function EditEntryModal({
  line,
  onClose,
  onOpenScreen,
}: {
  line: { description: string; detail?: string; date: string; deposit: number; withdrawal: number; sourceTable?: string | null; sourceId?: string | null }
  onClose: () => void
  onOpenScreen: () => void
}) {
  const qc = useQueryClient()
  const table = line.sourceTable
  const editable = isEditable(table) && !!line.sourceId

  const { data: row, isLoading, error } = useQuery({
    queryKey: ['bank_edit_row', table, line.sourceId],
    enabled: editable,
    queryFn: async () => {
      const { data, error: e } = await supabase.from(table as Editable).select('*').eq('id', line.sourceId as string).maybeSingle()
      if (e) throw e
      return data as unknown
    },
  })

  function done() {
    // The entry was posted again, so its line in this account (and its tick) may be new.
    qc.invalidateQueries({ queryKey: ['bank_lines'] })
    qc.invalidateQueries({ queryKey: ['bank_reconciliations'] })
    qc.invalidateQueries({ queryKey: ['bank_edit_row'] })
    onClose()
  }

  const amount = line.deposit > 0 ? line.deposit : line.withdrawal
  const inTable = (children: React.ReactNode) => (
    <table className="data">
      <tbody>{children}</tbody>
    </table>
  )

  let form: React.ReactNode = null
  if (editable && row) {
    switch (table) {
      case 'expenses':
        form = <ExpenseForm editingExpense={row as Tables['expenses']['Row']} onDoneEditing={done} />
        break
      case 'expense_reimbursements':
        form = inTable(<ExpenseReimbursementForm due={0} editingReimbursement={row as Tables['expense_reimbursements']['Row']} colSpan={1} onClose={done} />)
        break
      case 'vendor_bill_payments': {
        const p = row as Tables['vendor_bill_payments']['Row']
        form = inTable(<VendorBillPaymentForm billId={p.bill_id} due={0} editingPayment={p} colSpan={1} onClose={done} />)
        break
      }
      case 'invoice_payments':
        form = <EditInvoicePaymentFields payment={row as Tables['invoice_payments']['Row']} onClose={done} />
        break
      case 'loans':
        form = <LoanForm editingLoan={row as Tables['loans']['Row']} onDoneEditing={done} />
        break
    }
  }

  return (
    <Modal title={`Edit this ${NAME[table ?? ''] ?? 'entry'}`} onClose={onClose}>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>
          {fmtDate(line.date)} · {line.deposit > 0 ? '+' : '-'}
          {fmt2(amount)}
        </strong>
        <div className="retention-note">{line.description}</div>
        {line.detail && <div className="retention-note">{line.detail}</div>}
      </div>

      {!editable && (
        <>
          <div className="note">
            This kind of entry is changed in its own screen. Your bank statement stays loaded, and you can come back through Reports, then Bank reconciliation.
          </div>
          <Button type="button" onClick={onOpenScreen}>
            Open it in its screen
          </Button>
        </>
      )}
      {editable && isLoading && <div className="note">Loading…</div>}
      {editable && !isLoading && (error || !row) && <div className="note" style={{ color: 'var(--red)' }}>Could not load this entry. It may have been deleted.</div>}
      {form}
      {editable && !!row && <div className="note">Saving posts the entry again, so its tick is taken off and it is matched against the statement afresh.</div>}
    </Modal>
  )
}
