import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useClients, useProjects, useCostCenters } from '../../lib/queries/masters'
import { useCreateProject, useDeleteProject } from '../../lib/queries/admin'
import { fmt, parseINR } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ProjectsSection() {
  const { data: clients } = useClients()
  const { data: projects, isLoading } = useProjects()
  const { data: costCenters } = useCostCenters()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [costCenter, setCostCenter] = useState('')
  const [budget, setBudget] = useState('0')
  const [valueExGst, setValueExGst] = useState('0')
  const [startDate, setStartDate] = useState(todayStr())
  const [sameAsClient, setSameAsClient] = useState(true)
  const [projectLocation, setProjectLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!sameAsClient) return
    const client = clients?.find((c) => c.id === clientId)
    setProjectLocation(client?.city || '')
  }, [sameAsClient, clientId, clients])

  useEffect(() => {
    if (!costCenter && costCenters && costCenters.length > 0) {
      setCostCenter(costCenters[0].name)
    }
  }, [costCenters, costCenter])

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
    setSubmitting(true)
    try {
      await createProject.mutateAsync({
        name: name.trim(),
        client_id: clientId,
        status,
        cost_center: costCenter || null,
        budget: parseINR(budget) || null,
        value_ex_gst: parseINR(valueExGst) || null,
        project_location: projectLocation.trim() || null,
        same_as_client_address: sameAsClient,
        start_date: startDate || null,
      })
      setName('')
      setClientId('')
      setStatus('active')
      setCostCenter(costCenters?.[0]?.name ?? '')
      setBudget('0')
      setValueExGst('0')
      setSameAsClient(true)
      setProjectLocation('')
      setStartDate(todayStr())
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add project.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Projects</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Project name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
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
          <label>Cost center</label>
          <SearchableSelect
            items={costCenters}
            value={costCenter}
            onChange={setCostCenter}
            getId={(cc) => cc.name}
            getLabel={(cc) => cc.name}
            placeholder="— Select —"
          />
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

        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add project'}
          </Button>
        </div>
      </form>

      {formError && (
        <div className="note" style={{ color: 'var(--red)', marginTop: -10 }}>
          {formError}
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Project</th>
              <th>Client</th>
              <th>Project location</th>
              <th>Cost center</th>
              <th style={{ textAlign: 'right' }}>Budget</th>
              <th style={{ textAlign: 'right' }}>Total value</th>
              <th>Start date</th>
              <th>End date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!projects || projects.length === 0) && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No projects yet — add your first one above
                </td>
              </tr>
            )}
            {projects?.map((p) => {
              const client = clients?.find((c) => c.id === p.client_id)
              return (
                <tr key={p.id}>
                  <td>{p.display_id ?? '—'}</td>
                  <td>{p.name}</td>
                  <td>{clientLabel(client)}</td>
                  <td>{p.project_location ?? '—'}</td>
                  <td>{p.cost_center ?? '—'}</td>
                  <td className="amt">{p.budget ? fmt(p.budget) : '—'}</td>
                  <td className="amt">{p.value_ex_gst ? fmt(p.value_ex_gst) : '—'}</td>
                  <td>{p.start_date ?? '—'}</td>
                  <td>{p.end_date ?? '—'}</td>
                  <td>{p.status}</td>
                  <td>
                    <button type="button" className="btn danger-link" onClick={() => deleteProject.mutate(p.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
