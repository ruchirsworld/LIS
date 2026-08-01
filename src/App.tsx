import { lazy, Suspense, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './features/auth/LoginPage'
import { Shell } from './components/Shell'
import type { TabId } from './lib/nav'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('./features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const PurchasesPage = lazy(() => import('./features/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })))
const InvoicesPage = lazy(() => import('./features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const LoansPage = lazy(() => import('./features/loans/LoansPage').then((m) => ({ default: m.LoansPage })))
const CapitalPage = lazy(() => import('./features/capital/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const TransfersPage = lazy(() => import('./features/transfers/TransfersPage').then((m) => ({ default: m.TransfersPage })))
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

function AppShellRouter() {
  const [tab, setTab] = useState<TabId>('dashboard')

  return (
    <Shell active={tab} onChange={setTab}>
      <Suspense fallback={null}>
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'expenses' && <ExpensesPage />}
        {tab === 'purchases' && <PurchasesPage />}
        {tab === 'invoices' && <InvoicesPage />}
        {tab === 'loans' && <LoansPage />}
        {tab === 'capital' && <CapitalPage />}
        {tab === 'transfers' && <TransfersPage />}
        {tab === 'projects' && <ProjectsPage />}
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
