import { ModuleHeader } from '../../components/ui'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseTable } from './ExpenseTable'

export function ExpensesPage() {
  return (
    <div>
      <ModuleHeader>Expenses</ModuleHeader>
      <ExpenseForm />
      <ExpenseTable />
    </div>
  )
}
