import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useEmployees } from '../../lib/queries/masters'
import { useEmployeeSensitive, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '../../lib/queries/admin'
import { fmt, parseINR } from '../../lib/calc/format'

function maskAadhar(aadhar: string | null | undefined): string {
  if (!aadhar) return '—'
  const digits = aadhar.replace(/\D/g, '')
  if (digits.length < 4) return '••••'
  return `•••• •••• ${digits.slice(-4)}`
}

export function EmployeesSection() {
  const { data: employees, isLoading } = useEmployees()
  const { data: sensitive } = useEmployeeSensitive()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState('')
  const [aadhar, setAadhar] = useState('')
  const [pan, setPan] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('0')
  const [fuelAllowance, setFuelAllowance] = useState('0')
  const [otherAllowance, setOtherAllowance] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setDesignation('')
    setPhone('')
    setAadhar('')
    setPan('')
    setMonthlySalary('0')
    setFuelAllowance('0')
    setOtherAllowance('0')
  }

  function startEdit(emp: NonNullable<typeof employees>[number]) {
    const s = sensitive?.find((row) => row.employee_id === emp.id)
    setEditingId(emp.id)
    setName(emp.name)
    setDesignation(emp.designation ?? '')
    setPhone(emp.phone ?? '')
    setAadhar(s?.aadhar ?? '')
    setPan(s?.pan ?? '')
    setMonthlySalary(String(emp.monthly_salary ?? 0))
    setFuelAllowance(String(emp.fuel_allowance ?? 0))
    setOtherAllowance(String(emp.other_allowance ?? 0))
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Employee name is required.')
      return
    }
    setSubmitting(true)
    try {
      const employee = {
        name: name.trim(),
        designation: designation.trim() || null,
        phone: phone.trim() || null,
        monthly_salary: parseINR(monthlySalary) || null,
        fuel_allowance: parseINR(fuelAllowance) || null,
        other_allowance: parseINR(otherAllowance) || null,
      }
      if (editingId) {
        await updateEmployee.mutateAsync({
          id: editingId,
          employee,
          aadhar: aadhar.trim() || null,
          pan: pan.trim() || null,
        })
      } else {
        await createEmployee.mutateAsync({ employee, aadhar: aadhar.trim() || null, pan: pan.trim() || null })
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save employee.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <details className="toggle-section">
      <summary>Employees</summary>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="field full">
          <label>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field full">
          <label>Designation</label>
          <input
            type="text"
            placeholder="e.g. site supervisor"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Phone no.</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Aadhar no.</label>
          <input
            type="text"
            placeholder="12 digits"
            value={aadhar}
            onChange={(e) => setAadhar(e.target.value)}
          />
        </div>
        <div className="field">
          <label>PAN</label>
          <input type="text" placeholder="e.g. ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value)} />
        </div>
        <div className="field">
          <label>Monthly salary (₹)</label>
          <CurrencyInput value={monthlySalary} onValueChange={setMonthlySalary} />
        </div>
        <div className="field">
          <label>Fuel allowance (₹)</label>
          <CurrencyInput value={fuelAllowance} onValueChange={setFuelAllowance} />
        </div>
        <div className="field">
          <label>Other allowance (₹)</label>
          <CurrencyInput value={otherAllowance} onValueChange={setOtherAllowance} />
        </div>

        <div className="field full" style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add employee'}
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

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Phone</th>
              <th>Aadhar</th>
              <th>PAN</th>
              <th style={{ textAlign: 'right' }}>Monthly salary</th>
              <th style={{ textAlign: 'right' }}>Fuel allowance</th>
              <th style={{ textAlign: 'right' }}>Other allowance</th>
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
            {!isLoading && (!employees || employees.length === 0) && (
              <tr>
                <td colSpan={10} className="empty-row">
                  No employees yet
                </td>
              </tr>
            )}
            {employees?.map((emp) => {
              const s = sensitive?.find((row) => row.employee_id === emp.id)
              return (
                <tr key={emp.id}>
                  <td>{emp.display_id ?? '—'}</td>
                  <td>{emp.name}</td>
                  <td>{emp.designation ?? '—'}</td>
                  <td>{emp.phone ?? '—'}</td>
                  <td>{maskAadhar(s?.aadhar)}</td>
                  <td>{s?.pan ?? '—'}</td>
                  <td className="amt">{emp.monthly_salary ? fmt(emp.monthly_salary) : '—'}</td>
                  <td className="amt">{emp.fuel_allowance ? fmt(emp.fuel_allowance) : '—'}</td>
                  <td className="amt">{emp.other_allowance ? fmt(emp.other_allowance) : '—'}</td>
                  <td>
                    <button type="button" className="pay-btn" onClick={() => startEdit(emp)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger-link" onClick={() => deleteEmployee.mutate(emp.id)}>
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
