import { ModuleHeader } from '../../components/ui'
import { CapitalForm } from './CapitalForm'
import { CapitalTable } from './CapitalTable'
import { CapitalSummaryTable } from './CapitalSummaryTable'

export function CapitalPage() {
  return (
    <div>
      <ModuleHeader>Capital</ModuleHeader>
      <CapitalForm />
      <CapitalTable />
      <CapitalSummaryTable />
    </div>
  )
}
