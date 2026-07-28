import { useEffect, useState, type KeyboardEvent } from 'react'

/** Generic searchable dropdown for any reference/master-data list (clients,
 * projects, partners, employees, lenders, bank accounts, cost centers, …) —
 * typing filters the list instead of scrolling a long native <select>.
 * Mirrors VendorCombobox's interaction, minus the inline "create new" step
 * that's specific to vendors. */
export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getId,
  getLabel,
  placeholder = '— Select —',
}: {
  items: T[] | undefined
  value: string
  onChange: (id: string) => void
  getId: (item: T) => string
  getLabel: (item: T) => string
  placeholder?: string
}) {
  const list = items ?? []
  const selected = list.find((item) => getId(item) === value) ?? null
  const [query, setQuery] = useState(selected ? getLabel(selected) : '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!open) setQuery(selected ? getLabel(selected) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const q = query.trim().toLowerCase()
  const filtered = q ? list.filter((item) => getLabel(item).toLowerCase().includes(q)) : list

  function selectItem(item: T) {
    onChange(getId(item))
    setQuery(getLabel(item))
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlight]
      if (item) selectItem(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(selected ? getLabel(selected) : '')
    }
  }

  return (
    <div className="combobox">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setHighlight(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlight(0)
          if (value) onChange('')
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay so a click on a list item (onMouseDown) registers first.
          setTimeout(() => {
            setOpen(false)
            setQuery(selected ? getLabel(selected) : '')
          }, 150)
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combobox-list">
          {filtered.map((item, i) => (
            <li
              key={getId(item)}
              className={i === highlight ? 'combobox-item active' : 'combobox-item'}
              onMouseDown={(e) => {
                e.preventDefault()
                selectItem(item)
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {getLabel(item)}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <ul className="combobox-list">
          <li className="combobox-item disabled">No matches</li>
        </ul>
      )}
    </div>
  )
}
