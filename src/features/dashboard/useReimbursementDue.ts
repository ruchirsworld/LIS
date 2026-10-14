import { useMemo } from 'react'
import { useExpenses, useExpenseReimbursements } from '../../lib/queries/expenses'
import { useProfiles } from '../../lib/queries/admin'
import { useVendors } from '../../lib/queries/masters'
import { useVendorBills, useVendorBillPayments } from '../../lib/queries/purchases'
import { expenseDue, expenseReimbursed, type ReimbursementSource } from '../../lib/calc/expenses'

const UNKNOWN_USER = 'Unknown'

export interface DueDetail {
  id: string
  displayId: string
  date: string
  description: string
  amount: number
  reimbursed: number
  due: number
}

export interface DueUserRow {
  userId: string | null
  name: string
  due: number
  outstanding: { id: string; due: number; date: string; source: ReimbursementSource }[]
  details: DueDetail[]
}

/** What the firm still owes each person who paid something out of pocket: expenses marked reimbursable,
 * and vendor payments made in "Reimbursement" mode. A running total, not limited to any period, because
 * money owed does not stop being owed when it falls outside a date range. Largest amount first. */
export function useReimbursementDue(): DueUserRow[] {
  const { data: allExpenses } = useExpenses(null)
  const { data: profiles } = useProfiles()
  const { data: reimbursements } = useExpenseReimbursements()
  const { data: vendorPayments } = useVendorBillPayments()
  const { data: vendorBills } = useVendorBills(null)
  const { data: vendors } = useVendors()

  return useMemo(() => {
    const dueByUserId = new Map<string, DueUserRow>()
    function addDue(userId: string | null, source: ReimbursementSource, detail: DueDetail) {
      const key = userId ?? 'unknown'
      const outstanding = { id: detail.id, due: detail.due, date: detail.date, source }
      const existing = dueByUserId.get(key)
      if (existing) {
        existing.due += detail.due
        existing.outstanding.push(outstanding)
        existing.details.push(detail)
      } else {
        const name = (userId && profiles?.find((p) => p.id === userId)?.name) || UNKNOWN_USER
        dueByUserId.set(key, { userId, name, due: detail.due, outstanding: [outstanding], details: [detail] })
      }
    }

    ;(allExpenses ?? []).forEach((e) => {
      if (!e.reimbursable) return
      const expenseReimbursements = (reimbursements ?? []).filter((r) => r.expense_id === e.id)
      const due = expenseDue(e.amount, expenseReimbursements)
      if (due <= 0) return
      addDue(e.created_by, 'expense', {
        id: e.id,
        displayId: e.display_id ?? '',
        date: e.date,
        description: e.description || '—',
        amount: Number(e.amount || 0),
        reimbursed: expenseReimbursed(expenseReimbursements),
        due,
      })
    })

    // Vendor payments an employee made out of pocket — owed back the same way.
    ;(vendorPayments ?? []).forEach((p) => {
      if (p.payment_mode !== 'Reimbursement') return
      const paymentReimbursements = (reimbursements ?? []).filter((r) => r.vendor_bill_payment_id === p.id)
      const due = expenseDue(p.amount, paymentReimbursements)
      if (due <= 0) return
      const bill = vendorBills?.find((b) => b.id === p.bill_id)
      const vendorName = vendors?.find((v) => v.id === bill?.vendor_id)?.name ?? 'Vendor'
      addDue(p.paid_by, 'vendor_payment', {
        id: p.id,
        displayId: p.display_id ?? '',
        date: p.date,
        description: `Vendor payment — ${vendorName}${bill?.display_id ? ` (${bill.display_id})` : ''}`,
        amount: Number(p.amount || 0),
        reimbursed: expenseReimbursed(paymentReimbursements),
        due,
      })
    })
    dueByUserId.forEach((row) => {
      row.outstanding.sort((a, b) => a.date.localeCompare(b.date))
      row.details.sort((a, b) => a.date.localeCompare(b.date))
    })
    return Array.from(dueByUserId.values()).sort((a, b) => b.due - a.due)
  }, [allExpenses, profiles, reimbursements, vendorPayments, vendorBills, vendors])
}
