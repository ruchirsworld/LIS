import { useBankAccounts } from '../../lib/queries/masters'
import { spendByAccount, type SpendRow } from '../../lib/calc/spendByAccount'
import { fmt } from '../../lib/calc/format'

/** The same spending, split by the account it was paid from: Kotak, Cash, CBI and Reimbursement (plus any other
 * bank or imprest that was used). Shown above every list of trip spending so the total can be read by source. */
export function SpendBySource({
  expenses,
  label = 'Spent via',
  style,
  compact = false,
}: {
  expenses: SpendRow[]
  label?: string
  style?: React.CSSProperties
  /** A slim inline version, with no box around it, for use as part of a heading. */
  compact?: boolean
}) {
  const { data: banks } = useBankAccounts()
  const { lines, total } = spendByAccount(expenses, banks ?? [])

  return (
    <div
      role="group"
      aria-label={label}
      style={
        compact
          ? { display: 'flex', flexWrap: 'wrap', gap: '2px 14px', alignItems: 'baseline', fontSize: 11.5, ...style }
          : {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 18px',
              alignItems: 'baseline',
              padding: '8px 12px',
              margin: '8px 0',
              border: '1px solid var(--line)',
              borderRadius: 6,
              background: 'var(--paper-2)',
              fontSize: 13,
              ...style,
            }
      }
    >
      <strong style={{ fontSize: compact ? 10.5 : 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</strong>
      {lines.map((l) => (
        <span key={l.key} style={{ opacity: l.amount === 0 ? 0.55 : 1 }}>
          {l.label}{' '}
          <span className="amt" style={{ fontWeight: 600 }}>
            {fmt(l.amount)}
          </span>
        </span>
      ))}
      <span style={{ marginLeft: 'auto' }}>
        Total{' '}
        <span className="amt" style={{ fontWeight: 700 }}>
          {fmt(total)}
        </span>
      </span>
    </div>
  )
}
