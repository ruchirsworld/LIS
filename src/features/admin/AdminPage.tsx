import { ModuleHeader } from '../../components/ui'
import { ClientsSection } from './ClientsSection'
import { ProjectsSection } from './ProjectsSection'
import { UsersSection } from './UsersSection'
import { CostCentersSection } from './CostCentersSection'
import { CoASection } from './CoASection'
import { VendorsSection } from './VendorsSection'
import { EmployeesSection } from './EmployeesSection'
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
      <EmployeesSection />
      <CostCentersSection />
      <CoASection />
      <BankAccountsSection />
      <UsersSection />
    </div>
  )
}
