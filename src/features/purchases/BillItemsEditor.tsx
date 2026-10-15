import { Button } from '../../components/ui'
import { fmt } from '../../lib/calc/format'
import { emptyItem, itemAmount, itemsTotal, type BillItemDraft } from '../../lib/calc/billItems'

const UNITS = ['Nos', 'Kg', 'Bags', 'Ltr', 'm', 'sq ft', 'sq m', 'Box', 'Trip', 'Day']

/** The items bought on a bill: what, how many, at what rate. With a quantity and a rate the amount is worked out;
 * otherwise type the amount. The bill value is the total of the lines. */
export function BillItemsEditor({ items, onChange, idPrefix = 'bi' }: { items: BillItemDraft[]; onChange: (items: BillItemDraft[]) => void; idPrefix?: string }) {
  const set = (index: number, patch: Partial<BillItemDraft>) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index))

  return (
    <div style={{ margin: '6px 0 10px' }}>
      <datalist id={`${idPrefix}-units`}>
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: 80, textAlign: 'right' }}>Qty</th>
              <th style={{ width: 90 }}>Unit</th>
              <th style={{ width: 110, textAlign: 'right' }}>Rate (₹)</th>
              <th style={{ width: 120, textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const worked = parseFloat(it.qty) > 0 && parseFloat(it.rate) > 0
              return (
                <tr key={i}>
                  <td>
                    <input
                      aria-label={`Item ${i + 1} name`}
                      value={it.name}
                      placeholder="e.g. Areca palm 6 ft"
                      onChange={(e) => set(i, { name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input aria-label={`Item ${i + 1} quantity`} inputMode="decimal" value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} style={{ width: '100%', textAlign: 'right' }} />
                  </td>
                  <td>
                    <input aria-label={`Item ${i + 1} unit`} list={`${idPrefix}-units`} value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <input aria-label={`Item ${i + 1} rate`} inputMode="decimal" value={it.rate} onChange={(e) => set(i, { rate: e.target.value })} style={{ width: '100%', textAlign: 'right' }} />
                  </td>
                  <td>
                    <input
                      aria-label={`Item ${i + 1} amount`}
                      inputMode="decimal"
                      value={worked ? String(itemAmount(it)) : it.amount}
                      readOnly={worked}
                      title={worked ? 'Quantity times rate' : undefined}
                      onChange={(e) => set(i, { amount: e.target.value })}
                      style={{ width: '100%', textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn link" aria-label={`Remove item ${i + 1}`} onClick={() => remove(i)} style={{ padding: 0 }}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ fontWeight: 600 }}>
                Items total (the bill value before GST)
              </td>
              <td className="amt" style={{ fontWeight: 600 }}>
                {fmt(itemsTotal(items))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Button type="button" variant="secondary" style={{ marginTop: 6 }} onClick={() => onChange([...items, emptyItem()])}>
        + Add an item
      </Button>
    </div>
  )
}
