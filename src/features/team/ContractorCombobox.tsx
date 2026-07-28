import { useEffect, useState, type KeyboardEvent } from 'react'
import { useCreateVendorFull } from '../../lib/queries/admin'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

const CREATE = Symbol('create')

/** Searchable supplier picker for Team tracker: suggests vendors tagged
 * "Contractor", but (unlike VendorCombobox) still accepts any freely-typed
 * name — plenty of entries here are individual labourers, not vendors.
 * When allowCreate and the typed name doesn't match an existing contractor,
 * offers to save it as a new Vendor (category "Contractor") for future reuse. */
export function ContractorCombobox({
  contractors,
  value,
  onChange,
  allowCreate = false,
  placeholder = 'labour contractor or individual name',
}: {
  contractors: Vendor[] | undefined
  value: string
  onChange: (name: string) => void
  allowCreate?: boolean
  placeholder?: string
}) {
  const list = contractors ?? []
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [creating, setCreating] = useState(false)
  const createVendor = useCreateVendorFull()

  useEffect(() => {
    setHighlight(0)
  }, [value])

  const q = value.trim().toLowerCase()
  const filtered = q ? list.filter((v) => v.name.toLowerCase().includes(q)) : list
  const exactMatch = list.some((v) => v.name.toLowerCase() === q)
  const showCreate = allowCreate && q.length > 0 && !exactMatch
  const items: Array<Vendor | typeof CREATE> = showCreate ? [...filtered, CREATE] : filtered

  function selectVendor(v: Vendor) {
    onChange(v.name)
    setOpen(false)
  }

  async function createAndSelect() {
    if (creating) return
    setCreating(true)
    try {
      const created = await createVendor.mutateAsync({ name: value.trim(), category: 'Contractor' })
      onChange(created.name)
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
    }
  }

  return (
    <div className="combobox">
      <input
        type="text"
        required
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setHighlight(0)
        }}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay so a click on a list item (onMouseDown) registers first.
          setTimeout(() => setOpen(false), 150)
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
              {creating ? 'Adding…' : `+ Add "${value.trim()}" as new contractor`}
            </li>
          )}
        </ul>
      )}
      {open && !q && list.length === 0 && (
        <ul className="combobox-list">
          <li className="combobox-item disabled">No contractors yet — type a name to add one</li>
        </ul>
      )}
    </div>
  )
}
