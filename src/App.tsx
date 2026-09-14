import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { LanguageProvider } from './lib/i18n'
import { LoginPage } from './features/auth/LoginPage'
import { Shell } from './components/Shell'
import { LocationGate } from './components/LocationGate'
import { EXPENSE_COST_CENTERS, SUPERVISOR_EXPENSE_COST_CENTERS, type TabId, type ExpenseCostCenter } from './lib/nav'
import { requestLocationPing, type LocationPingResult } from './lib/workStore'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('./features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const ApprovalsPage = lazy(() => import('./features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })))
const SupervisorEntryPage = lazy(() =>
  import('./features/supervisor/SupervisorEntryPage').then((m) => ({ default: m.SupervisorEntryPage }))
)
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
  const [locationPing, setLocationPing] = useState<LocationPingResult | 'unknown'>('unknown')

  async function pingLocation() {
    if (!profile) return
    setLocationPing(await requestLocationPing(profile.id))
  }

  // A Supervisor can't use the app at all without granting location — this
  // fires on every login (AppShellRouter mounts once per signed-in
  // session, see AppInner below), and the render below blocks on anything
  // but a successful ping. There's no "skip for now": a denied/unavailable
  // result replaces the whole app with LocationGate until they grant it or
  // sign out.
  useEffect(() => {
    if (isSupervisor) void pingLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isSupervisor && locationPing !== 'ok') {
    return <LocationGate status={locationPing} onRetry={pingLocation} />
  }

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
        {tab === 'supervisor' && <SupervisorEntryPage />}
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
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
