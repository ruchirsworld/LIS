interface CostCenter {
  id: string
  name: string
}

/** Plain pill-tabs, one per configured cost center. */
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

  return (
    <div className="cc-picker">
      <div className="pill-tabs">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            className={value === c.name ? 'pill active' : 'pill'}
            onClick={() => onChange(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
