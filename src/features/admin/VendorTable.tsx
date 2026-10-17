import { useState } from 'react'
import { useVendors } from '../../lib/queries/masters'
import { useDeleteVendor } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorTable({ onEdit }: { onEdit: (vendor: Vendor) => void }) {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin'
  const { data: allVendors, isLoading } = useVendors()
  const deleteVendor = useDeleteVendor()
  const [showOneTime, setShowOneTime] = useState(false)
  const vendors = allVendors?.filter((v) => showOneTime || !v.is_one_time)

  const [search, setSearch] = useState('')
  const searched = search ? vendors?.filter((r) => matchesSearch(search, Object.values(r))) : vendors
  const { sorted: sortedVendors, sortKey, direction, toggleSort } = useSort(searched, {
    id: (v) => v.display_id,
    name: (v) => v.name,
    category: (v) => v.category,
    contact: (v) => v.contact_person,
    phone: (v) => v.phone,
    gstin: (v) => v.gstin ?? v.gstpan,
    address: (v) => v.address,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedVendors, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Vendors',
      columns: ['ID', 'Vendor', 'Category', 'Contact person', 'Phone', 'GSTIN', 'PAN', 'Address'],
      rows: (sortedVendors ?? []).map((v) => [
        v.display_id ?? '',
        v.name,
        v.category ?? '',
        v.contact_person ?? '',
        v.phone ?? '',
        v.gstin ?? v.gstpan ?? '',
        v.pan ?? '',
        v.address ?? '',
      ]),
    },
  ]

  return (
    <>
      <ReportExportButtons title="Vendors" sections={exportSections} range={null} />
      {allVendors?.some((v) => v.is_one_time) && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0', fontSize: 12, fontWeight: 400 }}>
          <input type="checkbox" checked={showOneTime} onChange={(e) => setShowOneTime(e.target.checked)} />
          Show one-time vendors
        </label>
      )}
      <TableSearch value={search} onChange={setSearch} />
      <TableScroll>
      <table className="data">
        <thead>
          <tr>
            <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Vendor" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Category" sortKey="category" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Contact person" sortKey="contact" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="Phone" sortKey="phone" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <SortableTh label="GSTIN" sortKey="gstin" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            <th>PAN</th>
            <SortableTh label="Address" sortKey="address" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
          {!isLoading && (!sortedVendors || sortedVendors.length === 0) && (
            <tr>
              <td colSpan={9} className="empty-row">
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
              <td>{v.gstin ?? v.gstpan ?? '—'}</td>
              <td>{v.pan ?? '—'}</td>
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
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  )
}
