import { ModuleHeader } from '../../components/ui'
import { EXPENSE_COST_CENTERS, type ExpenseCostCenter } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import { AdminExpensesSection } from './AdminExpensesSection'
import { ProjectExpensesSection } from './ProjectExpensesSection'
import { TripsSection } from '../trips/TripsSection'
import { ImportFileBlock } from '../admin/DataImportSection'
import { downloadExpensesImportTemplate } from '../../lib/import/expensesTemplate'
import { parseExpensesImport, commitExpensesImport } from '../../lib/import/runExpensesImport'

export function ExpensesPage({
  costCenter,
  onCostCenterChange,
  costCenters = EXPENSE_COST_CENTERS,
}: {
  costCenter: ExpenseCostCenter
  onCostCenterChange: (cc: ExpenseCostCenter) => void
  /** Which cost centers this user is allowed to switch between — e.g. a
   * Supervisor only ever sees "Project", not Admin Expenses or Trips. */
  costCenters?: readonly ExpenseCostCenter[]
}) {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const canImport = profile?.role === 'admin' || profile?.role === 'cxo'
  const t = useT()

  return (
    <div className="expenses-page">
      <ModuleHeader
        actions={
          costCenters.length > 1 && (
            <div className="cc-switch">
              {costCenters.map((cc) => (
                <button
                  key={cc}
                  type="button"
                  className={costCenter === cc ? 'cc-switch-btn active' : 'cc-switch-btn'}
                  onClick={() => onCostCenterChange(cc)}
                >
                  {cc}
                </button>
              ))}
            </div>
          )
        }
      >
        {isSupervisor ? t('Claims & Advances') : 'Expenses'}
      </ModuleHeader>

      {costCenter === 'Admin' && <AdminExpensesSection />}
      {costCenter === 'Trips' && <TripsSection />}
      {costCenter === 'Project' && <ProjectExpensesSection />}

      {canImport && (
        <ImportFileBlock
          label="Bulk-add expenses from Excel (Admin, Trips, or Project)"
          onDownload={downloadExpensesImportTemplate}
          onParse={parseExpensesImport}
          onCommit={commitExpensesImport}
          invalidateKeys={['expenses']}
        />
      )}
    </div>
  )
}
