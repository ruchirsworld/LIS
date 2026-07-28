import { useVendors } from '../../lib/queries/masters'
import { useDeleteVendor } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

export function VendorTable({ onEdit }: { onEdit: (vendor: Vendor) => void }) {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin'
  const { data: vendors, isLoading } = useVendors()
  const deleteVendor = useDeleteVendor()

  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            <th>ID</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Contact person</th>
            <th>Phone</th>
            <th>GST/PAN</th>
            <th>Address</th>
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
          {!isLoading && (!vendors || vendors.length === 0) && (
            <tr>
              <td colSpan={8} className="empty-row">
                No vendors yet
              </td>
            </tr>
          )}
          {vendors?.map((v) => (
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
  )
}
