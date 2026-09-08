import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

/** Searchable vendor picker: typing filters the list, click/Enter selects.
 * Adding a brand-new vendor isn't done here — see the "add a new vendor"
 * checkbox next to this field in VendorBillForm, which opens a proper
 * details popup instead of silently creating a name-only row. */
export function VendorCombobox({
  vendors,
  value,
  onChange,
  placeholder = '— Select vendor —',
}: {
  vendors: Vendor[] | undefined
  value: string
  onChange: (vendorId: string) => void
  placeholder?: string
}) {
  const list = vendors ?? []
  const selected = list.find((v) => v.id === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? list.filter((v) => v.name.toLowerCase().includes(q) || (v.phone ?? '').toLowerCase().includes(q))
    : list

  function selectVendor(v: Vendor) {
    onChange(v.id)
    setQuery(v.name)
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
      if (item) selectVendor(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(selected?.name ?? '')
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
            // Typing a vendor's full name and tabbing/clicking away without
            // explicitly clicking the suggestion used to leave nothing
            // selected — the input showed the right text, but the parent's
            // vendorId was still '', so submitting failed with "Pick a
            // vendor" even though the name was right there. Auto-select an
            // exact (case-insensitive) match on blur so that case works too.
            if (!selected) {
              const q2 = query.trim().toLowerCase()
              const match = q2 ? list.find((v) => v.name.toLowerCase() === q2) : undefined
              if (match) {
                onChange(match.id)
                setQuery(match.name)
                setOpen(false)
                return
              }
            }
            setOpen(false)
            setQuery(selected?.name ?? '')
          }, 150)
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combobox-list">
          {filtered.map((v, i) => (
            <li
              key={v.id}
              className={i === highlight ? 'combobox-item active' : 'combobox-item'}
              onMouseDown={(e) => {
                e.preventDefault()
                selectVendor(v)
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {v.name}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <ul className="combobox-list">
          <li className="combobox-item disabled">No vendors found</li>
        </ul>
      )}
    </div>
  )
}
