import { ModuleHeader } from '../../components/ui'
import { ClientsSection } from './ClientsSection'
import { ProjectsSection } from './ProjectsSection'
import { UsersSection } from './UsersSection'
import { CostCentersSection } from './CostCentersSection'
import { CoASection } from './CoASection'
import { PurposesSection } from './PurposesSection'
import { UnitsSection } from './UnitsSection'
import { VendorsSection } from './VendorsSection'
import { BankAccountsSection } from './BankAccountsSection'
import { DataImportSection } from './DataImportSection'

export function AdminPage() {
  return (
    <div>
      <ModuleHeader>Admin</ModuleHeader>

      <DataImportSection />
      <ClientsSection />
      <ProjectsSection />
      <VendorsSection />
      <CostCentersSection />
      <PurposesSection />
      <UnitsSection />
      <CoASection />
      <BankAccountsSection />
      <UsersSection />
    </div>
  )
}
