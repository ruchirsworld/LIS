import { useState } from 'react'
import { ModuleHeader } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { ClientsSection } from './ClientsSection'
import { ProjectsSection } from './ProjectsSection'
import { UsersSection } from './UsersSection'
import { CostCentersSection } from './CostCentersSection'
import { SubHeadsSection } from './SubHeadsSection'
import { UnitsSection } from './UnitsSection'
import { VendorsSection } from './VendorsSection'
import { StaffSection } from './StaffSection'
import { HolidaysSection } from './HolidaysSection'
import { BankAccountsSection } from './BankAccountsSection'

const headerButtonStyle = {
  background: '#fff',
  color: 'var(--accent)',
  border: 'none',
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const

export function AdminPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [view, setView] = useState<'general' | 'additional'>('general')

  // Additional Settings (Cost Centers, Chart of Accounts, Units, Bank
  // Accounts, Users) is Admin-only — CXO gets full control everywhere else,
  // but not here. Force back to General if a CXO session somehow still had
  // 'additional' selected (e.g. a role change mid-session).
  const effectiveView = isAdmin ? view : 'general'

  return (
    <div>
      <ModuleHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{effectiveView === 'general' ? 'Settings' : 'Additional Settings'}</span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setView(effectiveView === 'general' ? 'additional' : 'general')}
              style={headerButtonStyle}
            >
              {effectiveView === 'general' ? 'Additional Settings' : '← Back to Settings'}
            </button>
          )}
        </div>
      </ModuleHeader>

      {effectiveView === 'general' ? (
        <>
          <ClientsSection />
          <ProjectsSection />
          <VendorsSection />
          <StaffSection />
          <HolidaysSection />
        </>
      ) : (
        <>
          <CostCentersSection />
          <SubHeadsSection />
          <UnitsSection />
          <BankAccountsSection />
          <UsersSection />
        </>
      )}
    </div>
  )
}
