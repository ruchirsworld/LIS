import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import { ExpenseForm } from './ExpenseForm'
import { SupervisorProjectExpenseForm } from './SupervisorProjectExpenseForm'
import { ExpenseTable } from './ExpenseTable'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadSupervisorExpenseImportTemplate } from '../../lib/import/supervisorExpenseTemplate'
import { parseSupervisorExpenseImport, commitSupervisorExpenseImport } from '../../lib/import/runSupervisorExpenseImport'

export function ProjectExpensesSection() {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'
  const t = useT()

  return (
    <div>
      {isSupervisor ? (
        <SupervisorProjectExpenseForm />
      ) : (
        <ExpenseForm editingExpense={null} onDoneEditing={() => {}} lockToProjects />
      )}
      <ExpenseTable costCenterFilter="Project" title={t('Project expense records')} />

      {canImport && (
        <ImportFileBlock
          label="Bulk-add Supervisor Project expense claims from Excel"
          onDownload={downloadSupervisorExpenseImportTemplate}
          onParse={parseSupervisorExpenseImport}
          onCommit={commitSupervisorExpenseImport}
          invalidateKeys={['expenses', 'pending-field-expenses']}
        />
      )}
    </div>
  )
}
