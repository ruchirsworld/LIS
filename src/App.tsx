import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { LanguageProvider } from './lib/i18n'
import { LoginPage } from './features/auth/LoginPage'
import { Shell } from './components/Shell'
import { SplitPaneHead } from './components/SplitPaneHead'
import { useMediaQuery } from './lib/useMediaQuery'
import { LocationGate } from './components/LocationGate'
import {
  EXPENSE_COST_CENTERS,
  SUPERVISOR_EXPENSE_COST_CENTERS,
  TABS,
  isTabVisible,
  type TabId,
  type ExpenseCostCenter,
} from './lib/nav'
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

// Side by side needs room for two readable panes next to the sidebar.
const SPLIT_MIN_WIDTH = '(min-width: 1200px)'
const SPLIT_STORAGE_KEY = 'lis.split.tab'

function loadSplitTab(): TabId | null {
  try {
    const raw = sessionStorage.getItem(SPLIT_STORAGE_KEY)
    return TABS.some((t) => t.id === raw) ? (raw as TabId) : null
  } catch {
    return null
  }
}

function saveSplitTab(tab: TabId | null) {
  try {
    if (tab) sessionStorage.setItem(SPLIT_STORAGE_KEY, tab)
    else sessionStorage.removeItem(SPLIT_STORAGE_KEY)
  } catch {
    // Storage blocked — the split just won't survive a reload.
  }
}

function PageView({
  tab,
  expensesCostCenter,
  onExpensesCostCenterChange,
  expenseCostCenters,
}: {
  tab: TabId
  expensesCostCenter: ExpenseCostCenter
  onExpensesCostCenterChange: (cc: ExpenseCostCenter) => void
  expenseCostCenters: readonly ExpenseCostCenter[]
}) {
  return (
    <>
      {tab === 'dashboard' && <DashboardPage />}
      {tab === 'expenses' && (
        <ExpensesPage
          costCenter={expensesCostCenter}
          onCostCenterChange={onExpensesCostCenterChange}
          costCenters={expenseCostCenters}
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
    </>
  )
}

function AppShellRouter() {
  const { profile } = useAuth()
  const isSupervisor = profile?.role === 'supervisor'
  const allowedExpenseCostCenters = isSupervisor ? SUPERVISOR_EXPENSE_COST_CENTERS : EXPENSE_COST_CENTERS

  const [tab, setTab] = useState<TabId>('dashboard')
  const [expensesCostCenter, setExpensesCostCenter] = useState<ExpenseCostCenter>(isSupervisor ? 'Project' : 'Admin')
  // The second pane keeps its own cost-center choice, so Expenses can sit
  // beside Expenses (say Admin next to Project).
  const [splitExpensesCostCenter, setSplitExpensesCostCenter] = useState<ExpenseCostCenter>('Project')
  const [splitTab, setSplitTab] = useState<TabId | null>(loadSplitTab)
  const canSplit = useMediaQuery(SPLIT_MIN_WIDTH) && !isSupervisor
  const splitOpen = canSplit && splitTab !== null
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

  function changeSplitTab(next: TabId | null) {
    setSplitTab(next)
    saveSplitTab(next)
  }

  function toggleSplit() {
    // Open on something that complements the current page rather than a copy of it.
    changeSplitTab(splitOpen ? null : tab === 'dashboard' ? 'expenses' : 'dashboard')
  }

  const splitTabs = TABS.filter((t) => isTabVisible(t, profile?.role)).map((t) => ({ id: t.id, label: t.label }))

  return (
    <Shell
      active={tab}
      onChange={setTab}
      split={{ canSplit, isOpen: splitOpen, onToggle: toggleSplit, tab: splitTab }}
    >
      <Suspense fallback={null}>
        {splitOpen && splitTab ? (
          <div className="split-panes">
            <div className="split-pane">
              <PageView
                tab={tab}
                expensesCostCenter={expensesCostCenter}
                onExpensesCostCenterChange={setExpensesCostCenter}
                expenseCostCenters={allowedExpenseCostCenters}
              />
            </div>
            <div className="split-pane">
              <SplitPaneHead tab={splitTab} tabs={splitTabs} onChange={changeSplitTab} onClose={() => changeSplitTab(null)} />
              <PageView
                tab={splitTab}
                expensesCostCenter={splitExpensesCostCenter}
                onExpensesCostCenterChange={setSplitExpensesCostCenter}
                expenseCostCenters={allowedExpenseCostCenters}
              />
            </div>
          </div>
        ) : (
          <PageView
            tab={tab}
            expensesCostCenter={expensesCostCenter}
            onExpensesCostCenterChange={setExpensesCostCenter}
            expenseCostCenters={allowedExpenseCostCenters}
          />
        )}
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
