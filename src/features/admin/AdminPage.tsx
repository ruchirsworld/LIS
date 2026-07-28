import { ModuleHeader } from '../../components/ui'
import { usePartners } from '../../lib/queries/masters'
import { useCreatePartner, useRenamePartner, useDeletePartner } from '../../lib/queries/admin'
import { ClientsSection } from './ClientsSection'
import { ProjectsSection } from './ProjectsSection'
import { UsersSection } from './UsersSection'
import { SimpleListSection } from './SimpleListSection'
import { CostCentersSection } from './CostCentersSection'
import { CoASection } from './CoASection'
import { VendorsSection } from './VendorsSection'
import { EmployeesSection } from './EmployeesSection'
import { BankAccountsSection } from './BankAccountsSection'
import { DataImportSection } from './DataImportSection'

export function AdminPage() {
  const { data: partners, isLoading: partnersLoading } = usePartners()
  const createPartner = useCreatePartner()
  const renamePartner = useRenamePartner()
  const deletePartner = useDeletePartner()

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

      <SimpleListSection
        summary="Partners"
        items={partners}
        isLoading={partnersLoading}
        onCreate={(name) => createPartner.mutateAsync({ name })}
        onRename={(id, name) => renamePartner.mutateAsync({ id, name })}
        onDelete={(id) => deletePartner.mutate(id)}
        createLabel="Add partner"
        namePlaceholder="e.g. Rohan Sharma"
        note="Partners feed the dropdown on the Capital tab for injections and withdrawals."
      />
    </div>
  )
}
