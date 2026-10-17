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
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { RecordDetails } from '../reports/RecordDetailModal'
import { confirmAction } from '../../lib/feedback'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorTable({ onEdit }: { onEdit: (vendor: Vendor) => void }) {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin'
  const { data: allVendors, isLoading } = useVendors()
  const deleteVendor = useDeleteVendor()
  const openRows = useOpenRows()

  async function removeVendor(v: Vendor) {
    const ok = await confirmAction({ title: 'Delete vendor', message: `Delete ${v.name}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
    if (ok) deleteVendor.mutate(v.id)
  }
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
      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          {allVendors?.some((v) => v.is_one_time) && (
            <label className="check-inline" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
              <input type="checkbox" checked={showOneTime} onChange={(e) => setShowOneTime(e.target.checked)} />
              Show one-time vendors
            </label>
          )}
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Vendors" sections={exportSections} range={null} iconOnly style={{ marginTop: 0 }} />
      </div>
      <TableScroll>
      <table className="data">
        <thead>
          <tr>
            <th></th>
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
              <td colSpan={10} className="empty-row">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && (!sortedVendors || sortedVendors.length === 0) && (
            <tr>
              <td colSpan={10} className="empty-row">
                No vendors yet
              </td>
            </tr>
          )}
          {pageRows?.map((v) => (
            <RecordRow
              key={v.id}
              expanded={openRows.isOpen(v.id)}
              onToggle={() => openRows.toggle(v.id)}
              colSpan={10}
              details={<RecordDetails sourceTable="vendors" sourceId={v.id} />}
              onEdit={canManage ? () => onEdit(v) : undefined}
              onDelete={canManage ? () => void removeVendor(v) : undefined}
            >
              <td>{v.display_id ?? '—'}</td>
              <td>{v.name}</td>
              <td>{v.category ?? '—'}</td>
              <td>{v.contact_person ?? '—'}</td>
              <td>{v.phone ?? '—'}</td>
              <td>{v.gstin ?? v.gstpan ?? '—'}</td>
              <td>{v.pan ?? '—'}</td>
              <td>{v.address ?? '—'}</td>
            </RecordRow>
          ))}
        </tbody>
      </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  )
}
