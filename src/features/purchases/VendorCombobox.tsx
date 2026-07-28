import { useEffect, useState, type KeyboardEvent } from 'react'
import { useCreateVendorFull } from '../../lib/queries/admin'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

const CREATE = Symbol('create')

/** Searchable vendor picker: typing filters the list, and (when allowCreate)
 * an unmatched name offers a "+ Add as new vendor" entry that creates the
 * vendor inline and selects it. */
export function VendorCombobox({
  vendors,
  value,
  onChange,
  allowCreate = false,
  placeholder = '— Select vendor —',
}: {
  vendors: Vendor[] | undefined
  value: string
  onChange: (vendorId: string) => void
  allowCreate?: boolean
  placeholder?: string
}) {
  const list = vendors ?? []
  const selected = list.find((v) => v.id === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [creating, setCreating] = useState(false)
  const createVendor = useCreateVendorFull()

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const q = query.trim().toLowerCase()
  const filtered = q ? list.filter((v) => v.name.toLowerCase().includes(q)) : list
  const exactMatch = list.some((v) => v.name.toLowerCase() === q)
  const showCreate = allowCreate && q.length > 0 && !exactMatch
  const items: Array<Vendor | typeof CREATE> = showCreate ? [...filtered, CREATE] : filtered

  function selectVendor(v: Vendor) {
    onChange(v.id)
    setQuery(v.name)
    setOpen(false)
  }

  async function createAndSelect() {
    if (creating) return
    setCreating(true)
    try {
      const created = await createVendor.mutateAsync({ name: query.trim() })
      onChange(created.id)
      setQuery(created.name)
      setOpen(false)
    } catch {
      // keep the dropdown open with the typed text so the user can retry
    } finally {
      setCreating(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[highlight]
      if (item === CREATE) createAndSelect()
      else if (item) selectVendor(item)
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
            setOpen(false)
            setQuery(selected?.name ?? '')
          }, 150)
        }}
      />
      {open && items.length > 0 && (
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
          {showCreate && (
            <li
              className={highlight === filtered.length ? 'combobox-item create active' : 'combobox-item create'}
              onMouseDown={(e) => {
                e.preventDefault()
                createAndSelect()
              }}
              onMouseEnter={() => setHighlight(filtered.length)}
            >
              {creating ? 'Adding…' : `+ Add "${query.trim()}" as new vendor`}
            </li>
          )}
        </ul>
      )}
      {open && items.length === 0 && (
        <ul className="combobox-list">
          <li className="combobox-item disabled">No vendors found</li>
        </ul>
      )}
    </div>
  )
}
