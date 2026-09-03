import { useStaff } from '../../lib/queries/masters'
import { useDeleteStaff, useProfiles } from '../../lib/queries/admin'
import { useProjects } from '../../lib/queries/masters'
import { useAuth } from '../../lib/auth'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { fmt, fmtDate } from '../../lib/calc/format'
import type { Database } from '../../types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export function StaffTable({ onEdit }: { onEdit: (staff: Staff) => void }) {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin'
  const { data: staff, isLoading } = useStaff()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const deleteStaff = useDeleteStaff()

  const supervisorName = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : '—')

  const { sorted: sortedStaff, sortKey, direction, toggleSort } = useSort(staff, {
    id: (s) => s.display_id,
    name: (s) => s.name,
    phone: (s) => s.phone,
    rate: (s) => s.daily_rate,
    start: (s) => s.start_date,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedStaff)

  const exportSections: ExportSection[] = [
    {
      title: 'Staff',
      columns: ['ID', 'Name', 'Phone', 'Daily rate', 'Supervisor', 'Default project', 'Start date', 'End date'],
      rows: (sortedStaff ?? []).map((s) => [
        s.display_id ?? '',
        s.name,
        s.phone ?? '',
        s.daily_rate,
        supervisorName(s.supervisor_id),
        projectName(s.default_project_id),
        fmtDate(s.start_date),
        s.end_date ? fmtDate(s.end_date) : '',
      ]),
    },
  ]

  return (
    <>
      <ReportExportButtons title="Staff" sections={exportSections} range={null} />
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Name" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Phone" sortKey="phone" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Daily rate" sortKey="rate" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th>Supervisor</th>
              <th>Default project</th>
              <SortableTh label="Start" sortKey="start" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th>End</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedStaff || sortedStaff.length === 0) && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No staff yet
                </td>
              </tr>
            )}
            {pageRows?.map((s) => (
              <tr key={s.id}>
                <td>{s.display_id ?? '—'}</td>
                <td>{s.name}</td>
                <td>{s.phone ?? '—'}</td>
                <td className="amt">{fmt(s.daily_rate)}</td>
                <td>{supervisorName(s.supervisor_id)}</td>
                <td>{projectName(s.default_project_id)}</td>
                <td>{fmtDate(s.start_date)}</td>
                <td>{s.end_date ? fmtDate(s.end_date) : '—'}</td>
                <td>
                  {canManage && (
                    <>
                      <button type="button" className="pay-btn" onClick={() => onEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className="btn danger-link" onClick={() => deleteStaff.mutate(s.id)}>
                        Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  )
}
