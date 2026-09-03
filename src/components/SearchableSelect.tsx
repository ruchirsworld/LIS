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
  getSearchValue,
  placeholder = '— Select —',
  compact = false,
}: {
  items: T[] | undefined
  value: string
  onChange: (id: string) => void
  getId: (item: T) => string
  getLabel: (item: T) => string
  /** Text to match typed queries against, e.g. "name phone" so a vendor can
   * be found by either — defaults to getLabel when omitted. */
  getSearchValue?: (item: T) => string
  placeholder?: string
  /** Smaller, muted styling for use as a subtext-level picker under a label
   * (e.g. the project picker under a category name) rather than a full field. */
  compact?: boolean
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
  const matched = q
    ? list.filter((item) => (getSearchValue ? getSearchValue(item) : getLabel(item)).toLowerCase().includes(q))
    : list
  // Float the currently selected item to the top so it's visible without
  // scrolling when reopening a list to change an existing pick.
  const filtered = value
    ? [...matched].sort((a, b) => (getId(a) === value ? -1 : getId(b) === value ? 1 : 0))
    : matched

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
    <div className={compact ? 'combobox combobox-compact' : 'combobox'}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => {
          // Clear the leftover selected-label text so opening the list shows
          // every option, not just ones matching what's already selected —
          // otherwise picking "Cash" then reopening only shows items whose
          // name happens to contain "cash".
          setQuery('')
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
