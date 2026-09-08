import { ExpenseForm } from './ExpenseForm'
import { ExpenseTable } from './ExpenseTable'
import { ReimbursementRecordsTable } from './ReimbursementRecordsTable'

export function AdminExpensesSection() {
  return (
    <div>
      <ExpenseForm editingExpense={null} onDoneEditing={() => {}} />
      <ExpenseTable costCenterFilter="Admin" groupByDate />
      <ReimbursementRecordsTable />
    </div>
  )
}
