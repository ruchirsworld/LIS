interface CostCenter {
  id: string
  name: string
}

/**
 * Mini segmented control for the two most-used cost centers (NAN, DDN),
 * plus an always-visible dropdown for everything else (Field/project site,
 * Marketing & travel, and any admin-added ones).
 */
export function CostCenterPicker({
  value,
  onChange,
  costCenters,
}: {
  value: string
  onChange: (name: string) => void
  costCenters: CostCenter[] | undefined
}) {
  const list = costCenters ?? []
  const nan = list.find((c) => /nan/i.test(c.name))
  const ddn = list.find((c) => /ddn|dehradun/i.test(c.name))
  const others = list.filter((c) => c.id !== nan?.id && c.id !== ddn?.id)

  const tab = nan && value === nan.name ? 'nan' : ddn && value === ddn.name ? 'ddn' : 'others'

  return (
    <div className="cc-picker">
      <div className="pill-tabs">
        <button
          type="button"
          className={tab === 'nan' ? 'pill active' : 'pill'}
          disabled={!nan}
          onClick={() => nan && onChange(nan.name)}
        >
          NAN
        </button>
        <button
          type="button"
          className={tab === 'ddn' ? 'pill active' : 'pill'}
          disabled={!ddn}
          onClick={() => ddn && onChange(ddn.name)}
        >
          DDN
        </button>
      </div>
      <select
        className={tab === 'others' && value ? 'cc-others-select active' : 'cc-others-select'}
        value={tab === 'others' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {others.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
