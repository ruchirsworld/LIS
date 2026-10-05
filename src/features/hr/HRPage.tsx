import { useEffect, useState } from 'react'
import { useNavFilter } from '../../lib/navContext'
import { ModuleHeader } from '../../components/ui'
import { AttendanceSection } from './AttendanceSection'
import { SalarySection } from './SalarySection'
import { SiteImprestSection } from './SiteImprestSection'
import { CheckInsSection } from './CheckInsSection'

const HR_SECTIONS = ['Attendance', 'Salary', 'Imprest', 'Check-ins'] as const
type HrSection = (typeof HR_SECTIONS)[number]

export function HRPage() {
  const [section, setSection] = useState<HrSection>('Attendance')
  const nav = useNavFilter('hr')
  useEffect(() => {
    if (nav?.filter.hrSection) setSection(nav.filter.hrSection)
  }, [nav])

  return (
    <div className="hr-page">
      <ModuleHeader
        actions={
          <div className="cc-switch">
            {HR_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={section === s ? 'cc-switch-btn active' : 'cc-switch-btn'}
                onClick={() => setSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        HR
      </ModuleHeader>

      {section === 'Attendance' && <AttendanceSection />}
      {section === 'Salary' && <SalarySection />}
      {section === 'Imprest' && <SiteImprestSection />}
      {section === 'Check-ins' && <CheckInsSection />}
    </div>
  )
}
