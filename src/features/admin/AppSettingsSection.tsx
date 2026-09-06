import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import {
  useAppSettings,
  useUpdateAppSetting,
  TEAM_EXPENSE_WARNING_THRESHOLD_KEY,
  TEAM_EXPENSE_WARNING_THRESHOLD_DEFAULT,
} from '../../lib/queries/settings'
import { getErrorMessage } from '../../lib/errors'

// Admin/cxo-tunable thresholds that affect Supervisor-facing forms — kept
// separate from the Cost Centers/Chart of Accounts "Additional Settings"
// since these aren't masters data, just numeric knobs.
export function AppSettingsSection() {
  const { data: settings } = useAppSettings()
  const updateSetting = useUpdateAppSetting()

  const currentThreshold = settings?.get(TEAM_EXPENSE_WARNING_THRESHOLD_KEY) ?? TEAM_EXPENSE_WARNING_THRESHOLD_DEFAULT
  const [threshold, setThreshold] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const displayValue = threshold ?? String(currentThreshold)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const value = Number(displayValue)
    if (!Number.isFinite(value) || value < 0) {
      setFormError('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      await updateSetting.mutateAsync({ key: TEAM_EXPENSE_WARNING_THRESHOLD_KEY, value })
      setThreshold(null)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save this setting.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <h3 style={{ marginTop: 0, fontSize: 13 }}>Thresholds</h3>
      <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
        Controls used in Supervisor-facing forms.
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label>Food/Transport soft-warning amount (₹)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={displayValue}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <div className="note">
            When a Supervisor's Food + Transport claim for one entry exceeds this, they're asked to confirm before
            submitting — it doesn't block them.
          </div>
        </div>
        <div className="field full">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {formError && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {formError}
          </div>
        )}
      </form>
    </div>
  )
}
