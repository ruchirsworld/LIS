import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { LoanForm } from './LoanForm'
import { LoanQuickPaymentForm } from './LoanQuickPaymentForm'
import { LoanTable } from './LoanTable'
import type { Database } from '../../types/database'

type Loan = Database['public']['Tables']['loans']['Row']

export function LoansPage() {
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)

  return (
    <div>
      <ModuleHeader>Loans</ModuleHeader>
      <LoanForm editingLoan={editingLoan} onDoneEditing={() => setEditingLoan(null)} />
      <LoanQuickPaymentForm />
      <LoanTable onEdit={setEditingLoan} />
    </div>
  )
}
