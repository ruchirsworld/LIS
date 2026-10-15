import { Button } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { fmt2, fmtDate } from '../../lib/calc/format'
import type { LedgerCandidate, StatementMatch } from '../../lib/calc/bankMatch'

const dayNo = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000)

/** Choose what a statement line really is: another entry in the books with the same amount, or none of them. */
export function ChangeMatchModal({
  match,
  options,
  matchedElsewhere,
  onPick,
  onUnmatch,
  onClose,
}: {
  match: StatementMatch
  /** Entries in the books on the same side with the same amount, other than the current partner. */
  options: LedgerCandidate[]
  /** For an entry, the statement text it is currently matched to, if any. */
  matchedElsewhere: (ledgerId: string) => string | null
  onPick: (ledgerId: string) => void
  onUnmatch: () => void
  onClose: () => void
}) {
  const s = match.statement
  const amount = s.deposit > 0 ? s.deposit : s.withdrawal
  const sorted = [...options].sort((a, b) => Math.abs(dayNo(a.date) - dayNo(s.date)) - Math.abs(dayNo(b.date) - dayNo(s.date)))

  return (
    <Modal title="Change this match" onClose={onClose}>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>
          {fmtDate(s.date)} · {s.deposit > 0 ? '+' : '-'}
          {fmt2(amount)}
        </strong>{' '}
        on the statement
        <div className="retention-note">{s.description || s.reference}</div>
      </div>
      <div className="note">
        Now matched to: <strong>{match.ledger.description}</strong> ({fmtDate(match.ledger.date)}).
        {match.ledger.cleared ? ' It was already ticked, and changing the match removes that tick.' : ''}
      </div>

      <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Which entry in your books is it really?</h4>
      {sorted.length === 0 ? (
        <div className="note">There is no other entry for {fmt2(amount)} on this side. Only entries with the same amount can be matched.</div>
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const other = matchedElsewhere(l.id)
                return (
                  <tr key={l.id}>
                    <td>{fmtDate(l.date)}</td>
                    <td>
                      {l.description}
                      {l.cleared && <div className="retention-note">Already ticked</div>}
                      {other && <div className="retention-note">Now matched to another statement line: {other}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button type="button" onClick={() => onPick(l.id)}>
                        Match to this
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" onClick={onUnmatch}>
          None of these: unmatch it
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <div className="note">Unmatching puts the statement line under "not in your books" so you can record it, and the entry under "not on the statement".</div>
    </Modal>
  )
}
