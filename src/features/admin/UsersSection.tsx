import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import {
  useProfiles,
  useCreateUser,
  useUpdateProfile,
  useDeleteUser,
  useSupervisorProjects,
  useSetSupervisorProjects,
  type Profile,
} from '../../lib/queries/admin'
import { useProjects } from '../../lib/queries/masters'
import { getErrorMessage } from '../../lib/errors'
import { useAuth } from '../../lib/auth'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', cxo: 'CXO', supervisor: 'Supervisor' }

export function UsersSection() {
  const { profile: myProfile } = useAuth()
  const { data: profiles, isLoading } = useProfiles()
  const createUser = useCreateUser()
  const updateProfile = useUpdateProfile()
  const deleteUser = useDeleteUser()
  const { data: activeProjects } = useProjects()
  const setSupervisorProjects = useSetSupervisorProjects()

  const { sorted: sortedProfiles, sortKey, direction, toggleSort } = useSort(profiles, {
    name: (p) => p.name,
    phone: (p) => p.phone,
    role: (p) => p.role,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedProfiles)

  const exportSections: ExportSection[] = [
    {
      title: 'Users',
      columns: ['Name', 'Phone', 'Role'],
      rows: (sortedProfiles ?? []).map((p) => [p.name, p.phone ?? '', ROLE_LABEL[p.role] ?? p.role]),
    },
  ]

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<'cxo' | 'admin' | 'supervisor'>('cxo')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([])

  const { data: currentAssignments } = useSupervisorProjects(editingId)
  useEffect(() => {
    setAssignedProjectIds((currentAssignments ?? []).map((a) => a.project_id))
  }, [currentAssignments])

  const projectOptions = (activeProjects ?? []).filter((p) => p.status === 'active')

  function toggleAssignedProject(projectId: string) {
    setAssignedProjectIds((ids) => (ids.includes(projectId) ? ids.filter((id) => id !== projectId) : [...ids, projectId]))
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setPhone('')
    setPin('')
    setRole('cxo')
    setAssignedProjectIds([])
  }

  function startEdit(p: Profile) {
    setEditingId(p.id)
    setName(p.name)
    setRole(p.role)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (editingId) {
      if (!name.trim()) {
        setFormError('Name is required.')
        return
      }
      setSubmitting(true)
      try {
        await updateProfile.mutateAsync({ id: editingId, name: name.trim(), role })
        await setSupervisorProjects.mutateAsync({
          profileId: editingId,
          projectIds: role === 'supervisor' ? assignedProjectIds : [],
        })
        resetForm()
      } catch (err) {
        setFormError(getErrorMessage(err, 'Could not save user.'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!name.trim() || !phone.trim() || !pin) {
      setFormError('Name, phone, and PIN are required.')
      return
    }
    if (!/^\d{6}$/.test(pin)) {
      setFormError('PIN must be exactly 6 digits.')
      return
    }
    setSubmitting(true)
    try {
      await createUser.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        pin,
        role,
      })
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add user.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRemove(id: string) {
    deleteUser.mutate(id)
  }

  return (
    <details className="toggle-section">
      <summary>Users</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {!editingId && (
          <>
            <div className="field">
              <label>Phone no. (used to log in)</label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="field">
              <label>PIN</label>
              <input
                type="password"
                required
                inputMode="numeric"
                placeholder="6 digits"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </>
        )}
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="cxo">CXO</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </div>

        {editingId && role === 'supervisor' && (
          <div className="field full">
            <label>Assigned projects</label>
            <div
              className="note"
              style={{ margin: '0 0 8px' }}
            >
              Which project(s) this supervisor is responsible for — can be more than one.
            </div>
            {projectOptions.length === 0 && <div className="note">No active projects yet.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {projectOptions.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={assignedProjectIds.includes(p.id)}
                    onChange={() => toggleAssignedProject(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add user'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      <ReportExportButtons title="Users" sections={exportSections} range={null} />

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="Name" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Phone" sortKey="phone" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Role" sortKey="role" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedProfiles || sortedProfiles.length === 0) && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No users yet
                </td>
              </tr>
            )}
            {pageRows?.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.phone ?? '—'}</td>
                <td>{ROLE_LABEL[p.role] ?? p.role}</td>
                <td>
                  <button type="button" className="pay-btn" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  {p.id !== myProfile?.id && (
                    <button type="button" className="btn danger-link" onClick={() => handleRemove(p.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
