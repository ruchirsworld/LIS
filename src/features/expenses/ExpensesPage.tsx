import { ModuleHeader } from '../../components/ui'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseTable } from './ExpenseTable'
import { ReimbursementRecordsTable } from './ReimbursementRecordsTable'

export function ExpensesPage() {
  return (
    <div>
      <ModuleHeader>Payments</ModuleHeader>
      <ExpenseForm editingExpense={null} onDoneEditing={() => {}} />
      <ExpenseTable />
      <ReimbursementRecordsTable />
    </div>
  )
}
