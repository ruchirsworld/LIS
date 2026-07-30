import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseTable } from './ExpenseTable'
import type { Database } from '../../types/database'

type Expense = Database['public']['Tables']['expenses']['Row']

export function ExpensesPage() {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  return (
    <div>
      <ModuleHeader>Expenses</ModuleHeader>
      <ExpenseForm editingExpense={editingExpense} onDoneEditing={() => setEditingExpense(null)} />
      <ExpenseTable onEdit={setEditingExpense} />
    </div>
  )
}
