import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useClients, useProjects } from '../../lib/queries/masters'
import { useCreateProject, useUpdateProject, useDeleteProject } from '../../lib/queries/admin'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { getErrorMessage } from '../../lib/errors'
import { clientLabel, clientFullName } from '../../lib/labels'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ProjectsSection() {
  const { data: clients } = useClients()
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [budget, setBudget] = useState('0')
  const [valueExGst, setValueExGst] = useState('0')
  const [startDate, setStartDate] = useState(todayStr())
  const [sameAsClient, setSameAsClient] = useState(true)
  const [projectLocation, setProjectLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const clientNameOf = (p: NonNullable<typeof projects>[number]) => clientLabel(clients?.find((c) => c.id === p.client_id))
  const clientFullNameOf = (p: NonNullable<typeof projects>[number]) => clientFullName(clients?.find((c) => c.id === p.client_id))

  const [search, setSearch] = useState('')
  const searched = search ? projects?.filter((r) => matchesSearch(search, Object.values(r))) : projects
  const { sorted: sortedProjects, sortKey, direction, toggleSort } = useSort(searched, {
    code: (p) => p.code,
    name: (p) => p.name,
    client: (p) => clientNameOf(p),
    location: (p) => p.project_location,
    budget: (p) => p.budget,
    value: (p) => p.value_ex_gst,
    startDate: (p) => p.start_date,
    endDate: (p) => p.end_date,
    status: (p) => p.status,
  })
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedProjects, search)

  const exportSections: ExportSection[] = [
    {
      title: 'Projects',
      columns: ['Code', 'Project', 'Client', 'Project location', 'Budget', 'Total value', 'Start date', 'End date', 'Status'],
      rows: (sortedProjects ?? []).map((p) => [
        p.code ?? '',
        p.name,
        clientFullNameOf(p),
        p.project_location ?? '',
        p.budget ?? '',
        p.value_ex_gst ?? '',
        p.start_date ? fmtDate(p.start_date) : '',
        p.end_date ? fmtDate(p.end_date) : '',
        p.status,
      ]),
    },
  ]

  useEffect(() => {
    if (!sameAsClient) return
    const client = clients?.find((c) => c.id === clientId)
    setProjectLocation(client?.city || '')
  }, [sameAsClient, clientId, clients])

  function resetForm() {
    setEditingId(null)
    setName('')
    setCode('')
    setClientId('')
    setStatus('active')
    setBudget('0')
    setValueExGst('0')
    setSameAsClient(true)
    setProjectLocation('')
    setStartDate(todayStr())
  }

  function startEdit(p: NonNullable<typeof projects>[number]) {
    setFormOpen(true)
    setEditingId(p.id)
    setName(p.name)
    setCode(p.code ?? '')
    setClientId(p.client_id)
    setStatus(p.status as 'active' | 'completed')
    setBudget(p.budget != null ? String(p.budget) : '0')
    setValueExGst(p.value_ex_gst != null ? String(p.value_ex_gst) : '0')
    setSameAsClient(p.same_as_client_address)
    setProjectLocation(p.project_location ?? '')
    setStartDate(p.start_date ?? todayStr())
    setFormError(null)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteProject.mutateAsync(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDeleteError(
        message.includes('foreign key constraint') || message.includes('violates')
          ? 'Cannot remove this project — it still has expenses, invoices, vendor bills, or team tracker entries linked to it. Remove those first, or mark the project as Completed instead of deleting it.'
          : message
      )
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Project name is required.')
      return
    }
    if (!clientId) {
      setFormError('Pick a client.')
      return
    }
    const codeValue = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{4}$/.test(codeValue)) {
      setFormError('Project code must be exactly 4 characters (letters or numbers).')
      return
    }
    setSubmitting(true)
    try {
      const patch = {
        name: name.trim(),
        code: codeValue,
        client_id: clientId,
        status,
        cost_center: 'Project',
        budget: parseINR(budget) || null,
        value_ex_gst: parseINR(valueExGst) || null,
        project_location: projectLocation.trim() || null,
        same_as_client_address: sameAsClient,
        start_date: startDate || null,
      }
      if (editingId) {
        await updateProject.mutateAsync({ id: editingId, patch })
      } else {
        await createProject.mutateAsync(patch)
      }
      resetForm()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save project.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Projects</summary>

      <details
        className="toggle-section"
        style={{ marginTop: 16 }}
        open={formOpen}
        onToggle={(e) => setFormOpen(e.currentTarget.open)}
      >
        <summary>{editingId ? 'Edit project' : 'Add new project'}</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Project name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Project code (4 characters)</label>
          <input
            type="text"
            required
            maxLength={4}
            placeholder="e.g. UJI7"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          />
        </div>
        <div className="field">
          <label>Client</label>
          <SearchableSelect
            items={clients}
            value={clientId}
            onChange={setClientId}
            getId={(c) => c.id}
            getLabel={(c) => clientLabel(c)}
            placeholder="— Select client —"
          />
        </div>

        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="field">
          <label>Budget (₹)</label>
          <CurrencyInput value={budget} onValueChange={setBudget} />
        </div>
        <div className="field">
          <label>Total value, ex. GST (₹)</label>
          <CurrencyInput value={valueExGst} onValueChange={setValueExGst} />
        </div>

        <div className="field">
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="field full row-inline">
          <input
            type="checkbox"
            id="p-same-address"
            checked={sameAsClient}
            onChange={(e) => setSameAsClient(e.target.checked)}
          />
          <label htmlFor="p-same-address">Same as client city</label>
        </div>
        <div className="field full">
          <label>Project location</label>
          <input
            type="text"
            disabled={sameAsClient}
            value={projectLocation}
            onChange={(e) => setProjectLocation(e.target.value)}
          />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add project'}
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
      </details>

      <details className="toggle-section" style={{ marginTop: 12 }} open>
        <summary>Project list</summary>

      {deleteError && (
        <div className="note" style={{ color: 'var(--red)' }}>
          {deleteError}
        </div>
      )}

      <ReportExportButtons title="Projects" sections={exportSections} range={null} />

      <TableSearch value={search} onChange={setSearch} />
      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="Code" sortKey="code" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project" sortKey="name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Client" sortKey="client" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Project location" sortKey="location" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Budget" sortKey="budget" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Total value" sortKey="value" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Start date" sortKey="startDate" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="End date" sortKey="endDate" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} />
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
            {!isLoading && (!sortedProjects || sortedProjects.length === 0) && (
              <tr>
                <td colSpan={10} className="empty-row">
                  No projects yet — add your first one above
                </td>
              </tr>
            )}
            {pageRows?.map((p) => {
              const client = clients?.find((c) => c.id === p.client_id)
              return (
                <tr key={p.id}>
                  <td>{p.code ?? '—'}</td>
                  <td>{p.name}</td>
                  <td>{clientLabel(client)}</td>
                  <td>{p.project_location ?? '—'}</td>
                  <td className="amt">{p.budget ? fmt(p.budget) : '—'}</td>
                  <td className="amt">{p.value_ex_gst ? fmt(p.value_ex_gst) : '—'}</td>
                  <td>{p.start_date ? fmtDate(p.start_date) : '—'}</td>
                  <td>{p.end_date ? fmtDate(p.end_date) : '—'}</td>
                  <td>{p.status}</td>
                  <td>
                    <button type="button" className="pay-btn" onClick={() => startEdit(p)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger-link" onClick={() => handleDelete(p.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
      </details>
    </details>
  )
}
