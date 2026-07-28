import { useState } from 'react'
import type { Database } from '../../types/database'

type Vendor = Database['public']['Tables']['vendors']['Row']

/** Shared "pick a vendor type, then narrow the vendor list to it" behavior
 * for the Purchase forms (Expenses' Purchase category, Vendor bills, Record
 * payments) — one category selection per form, resetting whatever vendor
 * was already picked since it may not belong to the newly selected type. */
export function useVendorCategoryFilter(vendors: Vendor[] | undefined, onCategoryChange: () => void) {
  const [category, setCategoryState] = useState<string | null>(null)
  const categories = Array.from(new Set(vendors?.map((v) => v.category).filter((c): c is string => !!c))).sort()
  const filteredVendors = category ? vendors?.filter((v) => v.category === category) : vendors

  function setCategory(next: string | null) {
    setCategoryState(next)
    onCategoryChange()
  }

  return { categories, category, setCategory, filteredVendors }
}

export function VendorCategoryPills({
  categories,
  category,
  onChange,
}: {
  categories: string[]
  category: string | null
  onChange: (category: string | null) => void
}) {
  if (categories.length === 0) return null
  return (
    <div className="pill-tabs" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
      <button type="button" className={category === null ? 'pill active' : 'pill'} onClick={() => onChange(null)}>
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={category === cat ? 'pill active' : 'pill'}
          onClick={() => onChange(category === cat ? null : cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
