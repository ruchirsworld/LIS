import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './features/auth/LoginPage'
import { Shell } from './components/Shell'
import { EXPENSE_COST_CENTERS, SUPERVISOR_EXPENSE_COST_CENTERS, type TabId, type ExpenseCostCenter } from './lib/nav'
import { captureAndPing } from './lib/workStore'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('./features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const ApprovalsPage = lazy(() => import('./features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })))
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const SupervisorRecordsPage = lazy(() =>
  import('./features/records/SupervisorRecordsPage').then((m) => ({ default: m.SupervisorRecordsPage }))
)
const PurchasesPage = lazy(() => import('./features/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })))
const VendorPage = lazy(() => import('./features/vendor/VendorPage').then((m) => ({ default: m.VendorPage })))
const InvoicesPage = lazy(() => import('./features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const LoansPage = lazy(() => import('./features/loans/LoansPage').then((m) => ({ default: m.LoansPage })))
const CapitalPage = lazy(() => import('./features/capital/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const TransfersPage = lazy(() => import('./features/transfers/TransfersPage').then((m) => ({ default: m.TransfersPage })))
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const HRPage = lazy(() => import('./features/hr/HRPage').then((m) => ({ default: m.HRPage })))
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

function AppShellRouter() {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const allowedExpenseCostCenters = isSupervisor ? SUPERVISOR_EXPENSE_COST_CENTERS : EXPENSE_COST_CENTERS

  const [tab, setTab] = useState<TabId>('dashboard')
  const [expensesCostCenter, setExpensesCostCenter] = useState<ExpenseCostCenter>(isSupervisor ? 'Project' : 'Admin')

  // One location ping per login, independent of the Start Work toggle — so a
  // Supervisor's location is on record just from opening the app, not only
  // when they remember to tap Start Work. AppShellRouter only mounts once
  // per signed-in session (see AppInner below), so this fires once per login.
  useEffect(() => {
    if (isSupervisor && profile) captureAndPing(profile.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Shell active={tab} onChange={setTab}>
      <Suspense fallback={null}>
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'expenses' && (
          <ExpensesPage
            costCenter={expensesCostCenter}
            onCostCenterChange={setExpensesCostCenter}
            costCenters={allowedExpenseCostCenters}
          />
        )}
        {tab === 'approvals' && <ApprovalsPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'records' && <SupervisorRecordsPage />}
        {tab === 'purchases' && <PurchasesPage />}
        {tab === 'vendor' && <VendorPage />}
        {tab === 'invoices' && <InvoicesPage />}
        {tab === 'loans' && <LoansPage />}
        {tab === 'capital' && <CapitalPage />}
        {tab === 'transfers' && <TransfersPage />}
        {tab === 'projects' && <ProjectsPage />}
        {tab === 'hr' && <HRPage />}
        {tab === 'reports' && <ReportsPage />}
        {tab === 'admin' && <AdminPage />}
      </Suspense>
    </Shell>
  )
}

function AppInner() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <LoginPage />
  return <AppShellRouter />
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

export default App
