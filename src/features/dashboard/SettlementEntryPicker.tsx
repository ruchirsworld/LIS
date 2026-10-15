import { Button } from '../../components/ui'
import { fmt, fmtDate } from '../../lib/calc/format'
import { oldestFirstChoices, type ChosenAmounts, type OutstandingExpense } from '../../lib/calc/expenses'

export interface PickerEntry {
  id: string
  displayId: string
  date: string
  description: string
  due: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Choose which entries a repayment settles, and how much of each. The default split is oldest first;
 * this lets the person say, for example, that the whole payment was for one particular entry. */
export function SettlementEntryPicker({
  entries,
  outstanding,
  amount,
  value,
  onChange,
  idPrefix = 'sep',
}: {
  entries: PickerEntry[]
  outstanding: OutstandingExpense[]
  /** What was paid. */
  amount: number
  value: ChosenAmounts
  onChange: (value: ChosenAmounts) => void
  idPrefix?: string
}) {
  const given = round2(Object.values(value).reduce((s, v) => s + (Number(String(v).replace(/,/g, '')) || 0), 0))
  const left = round2(amount - given)

  return (
    <div style={{ flexBasis: '100%', margin: '4px 0' }}>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Entry</th>
              <th style={{ textAlign: 'right' }}>Still due</th>
              <th style={{ width: 130, textAlign: 'right' }}>This payment (₹)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.displayId || 'Entry'} · {fmtDate(e.date)}
                  <div className="retention-note">{e.description}</div>
                </td>
                <td className="amt">{fmt(e.due)}</td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    id={`${idPrefix}-${e.id}`}
                    aria-label={`Amount for ${e.displayId || 'entry'} dated ${e.date}`}
                    inputMode="decimal"
                    value={value[e.id] ?? ''}
                    onChange={(ev) => onChange({ ...value, [e.id]: ev.target.value })}
                    style={{ width: 110, textAlign: 'right' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
        <Button type="button" variant="secondary" onClick={() => onChange(oldestFirstChoices(amount, outstanding))}>
          Fill oldest first
        </Button>
        <span style={{ color: Math.abs(left) < 0.005 ? 'var(--green)' : 'var(--amber)' }}>
          {Math.abs(left) < 0.005 ? 'All of the payment is given to entries.' : left > 0 ? `${fmt(left)} still to give to an entry.` : `${fmt(-left)} too much.`}
        </span>
      </div>
    </div>
  )
}
