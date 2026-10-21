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
import { TransferForm } from '../transfers/TransferForm'
import { CapitalForm } from '../capital/CapitalForm'
import { VendorBillForm } from '../purchases/VendorBillForm'
import { InvoiceForm } from '../invoices/InvoiceForm'

type Tables = Database['public']['Tables']

/** The kinds of entry that can be changed here, in a popup, without leaving the page. */
const EDITABLE = ['expenses', 'expense_reimbursements', 'vendor_bill_payments', 'invoice_payments', 'loans', 'transfers', 'capital_transactions', 'vendor_bills', 'invoices'] as const
type Editable = (typeof EDITABLE)[number]
const isEditable = (t: string | null | undefined): t is Editable => !!t && (EDITABLE as readonly string[]).includes(t)

const NAME: Record<string, string> = {
  expenses: 'expense',
  expense_reimbursements: 'reimbursement',
  vendor_bill_payments: 'vendor payment',
  invoice_payments: 'client receipt',
  loans: 'loan',
  transfers: 'transfer',
  capital_transactions: 'capital entry',
  vendor_bills: 'vendor bill',
  invoices: 'invoice',
}

/** Change an entry in a popup, without leaving the page. In Bank reconciliation, saving re-posts the entry, so its tick is taken off and it is
 * matched again against the statement. In a list (`context="list"`, for example Activity by user) the lists simply refresh. Entry kinds with no
 * form here (advances, wages, imprest, other receipts and loan repayments) are changed in their own screen. */
export function EditEntryModal({
  line,
  onClose,
  onOpenScreen,
  context = 'reconciliation',
}: {
  line: { description: string; detail?: string; date: string; deposit: number; withdrawal: number; sourceTable?: string | null; sourceId?: string | null }
  onClose: () => void
  onOpenScreen: () => void
  context?: 'reconciliation' | 'list'
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
    if (context === 'list') {
      // Any list may show this entry, and the books behind it changed, so everything reads again.
      qc.invalidateQueries()
    } else {
      // The entry was posted again, so its line in this account (and its tick) may be new.
      qc.invalidateQueries({ queryKey: ['bank_lines'] })
      qc.invalidateQueries({ queryKey: ['bank_reconciliations'] })
      qc.invalidateQueries({ queryKey: ['bank_edit_row'] })
    }
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
      case 'transfers':
        form = <TransferForm editing={row as Tables['transfers']['Row']} onDone={done} />
        break
      case 'capital_transactions':
        form = <CapitalForm editing={row as Tables['capital_transactions']['Row']} onDone={done} />
        break
      case 'vendor_bills':
        form = <VendorBillForm editingBill={row as Tables['vendor_bills']['Row']} onDoneEditing={done} inModal />
        break
      case 'invoices':
        form = <InvoiceForm editingInvoice={row as Tables['invoices']['Row']} onDoneEditing={done} inModal />
        break
    }
  }

  return (
    <Modal wide={context === 'list'} title={`Edit this ${NAME[table ?? ''] ?? 'entry'}`} onClose={onClose}>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>
          {fmtDate(line.date)}
          {amount > 0 ? ` · ${line.deposit > 0 ? '+' : '-'}${fmt2(amount)}` : ''}
        </strong>
        <div className="retention-note">{line.description}</div>
        {line.detail && <div className="retention-note">{line.detail}</div>}
      </div>

      {!editable && (
        <>
          <div className="note">
            This kind of entry is changed in its own screen.{context === 'reconciliation' ? ' Your bank statement is saved, and you can come back through Finance, then Reconciliation.' : ''}
          </div>
          <Button type="button" onClick={onOpenScreen}>
            Open it in its screen
          </Button>
        </>
      )}
      {editable && isLoading && <div className="note">Loading…</div>}
      {editable && !isLoading && (error || !row) && <div className="note" style={{ color: 'var(--red)' }}>Could not load this entry. It may have been deleted.</div>}
      {form}
      {editable && !!row && context === 'reconciliation' && <div className="note">Saving posts the entry again, so its tick is taken off and it is matched against the statement afresh.</div>}
    </Modal>
  )
}
