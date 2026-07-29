import { useVendors } from '../../lib/queries/masters'
import { useDeleteVendor } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorTable({ onEdit }: { onEdit: (vendor: Vendor) => void }) {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin'
  const { data: vendors, isLoading } = useVendors()
  const deleteVendor = useDeleteVendor()

  const { sorted: sortedVendors, sortKey, direction, toggleSort } = useSort(vendors, {
    id: (v) => v.display_id,
    name: (v) => v.name,
    category: (v) => v.category,
    contact: (v) => v.contact_person,
    phone: (v) => v.phone,
    gstpan: (v) => v.gstpan,
    address: (v) => v.address,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedVendors)

  const exportSections: ExportSection[] = [
    {
      title: 'Vendors',
      columns: ['ID', 'Vendor', 'Category', 'Contact person', 'Phone', 'GST/PAN', 'Address'],
      rows: (sortedVendors ?? []).map((v) => [
        v.display_id ?? '',
        v.name,
        v.category ?? '',
        v.contact_person ?? '',
        v.phone ?? '',
        v.gstpan ?? '',
        v.address ?? '',
      ]),
    },
  ]

  return (
    <>
      <ReportExportButtons title="Vendors" sections={exportSections} range={null} />
      <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Vendor" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Category" sortKey="category" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Contact person" sortKey="contact" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Phone" sortKey="phone" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="GST/PAN" sortKey="gstpan" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Address" sortKey="address" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={8} className="empty-row">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && (!sortedVendors || sortedVendors.length === 0) && (
            <tr>
              <td colSpan={8} className="empty-row">
                No vendors yet
              </td>
            </tr>
          )}
          {pageRows?.map((v) => (
            <tr key={v.id}>
              <td>{v.display_id ?? '—'}</td>
              <td>{v.name}</td>
              <td>{v.category ?? '—'}</td>
              <td>{v.contact_person ?? '—'}</td>
              <td>{v.phone ?? '—'}</td>
              <td>{v.gstpan ?? '—'}</td>
              <td>{v.address ?? '—'}</td>
              <td>
                {canManage && (
                  <>
                    <button type="button" className="pay-btn" onClick={() => onEdit(v)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger-link" onClick={() => deleteVendor.mutate(v.id)}>
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  )
}
