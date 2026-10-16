import { useState } from 'react'
import { Button } from '../../components/ui'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { signoffStatus, withinTolerance, type BankLine, type ReconciliationSummary } from '../../lib/calc/bankReconciliation'
import { getErrorMessage } from '../../lib/errors'
import { confirmAction, toast } from '../../lib/feedback'
import { useProfiles } from '../../lib/queries/admin'
import { useBankSignoffs, useDeleteBankSignoff, useSaveBankSignoff } from '../../lib/queries/books'

/** The last step: confirm that the reconciliation is finished, and keep a record of it. Ticks are saved as
 * they are made; this records that the account was reconciled to a statement date, by whom and with what result. */
export function BankSignoff({
  bankId,
  bankName,
  statementDate,
  balanceText,
  statementBalance,
  summary,
  ledger,
  pendingMatches,
}: {
  bankId: string
  bankName: string
  statementDate: string
  balanceText: string
  statementBalance: number
  summary: ReconciliationSummary
  ledger: BankLine[]
  /** Statement lines matched to the books but not yet ticked. */
  pendingMatches: number
}) {
  const { data: signoffs } = useBankSignoffs(bankId)
  const { data: profiles } = useProfiles()
  const save = useSaveBankSignoff()
  const remove = useDeleteBankSignoff()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const nameOf = (id: string | null) => profiles?.find((p) => p.id === id)?.name ?? 'Someone'
  const entered = balanceText.trim() !== ''
  const agrees = entered && withinTolerance(summary.difference)
  const existing = signoffs?.find((s) => s.statement_date === statementDate)

  async function done() {
    const diffText = agrees ? 'The books and the bank statement agree.' : `There is a difference of ${fmt2(summary.difference)}, explained as: "${note.trim()}".`
    const lines = [
      `${bankName} as at ${fmtDate(statementDate)}.`,
      `Bank statement balance ${fmt2(statementBalance)}. Books balance ${fmt2(summary.bookBalance)}.`,
      diffText,
    ]
    if (pendingMatches > 0) lines.push(`${pendingMatches} matched line${pendingMatches === 1 ? ' is' : 's are'} still not ticked.`)
    if (existing) lines.push('This replaces the reconciliation already saved for this date.')
    const ok = await confirmAction({ title: 'Save this reconciliation?', message: lines.join(' '), confirmLabel: 'Yes, save it' })
    if (!ok) return
    setBusy(true)
    try {
      await save.mutateAsync({
        bank_account_id: bankId,
        statement_date: statementDate,
        statement_balance: statementBalance,
        book_balance: summary.bookBalance,
        uncleared_deposits: summary.unclearedDeposits,
        uncleared_withdrawals: summary.unclearedWithdrawals,
        difference: summary.difference,
        note: note.trim() || null,
        completed_at: new Date().toISOString(),
      })
      setNote('')
      toast('success', `${bankName} reconciliation saved as at ${fmtDate(statementDate)}.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the reconciliation.'))
    } finally {
      setBusy(false)
    }
  }

  async function reopen(id: string, date: string) {
    const ok = await confirmAction({
      title: 'Remove this saved reconciliation?',
      message: `The reconciliation saved for ${fmtDate(date)} is removed. Your ticks stay. You can save it again when you are done.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(id)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not remove it.'))
    }
  }

  const needsNote = entered && !agrees
  const canSave = entered && !busy && (agrees || note.trim().length >= 3)

  return (
    <section aria-label="Finish the reconciliation" style={{ margin: '18px 0', padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Finish</h3>
      <div className="note" style={{ marginTop: 0 }}>
        Your ticks are saved as you make them. When you have finished, press <strong>Done</strong> to record that {bankName || 'this account'} is reconciled up to{' '}
        {fmtDate(statementDate)}.
      </div>

      {existing && (
        <div className="note" style={{ color: 'var(--green)', fontWeight: 600 }}>
          Saved: {nameOf(existing.completed_by)} confirmed this on {fmtDate(existing.completed_at.slice(0, 10))}
          {withinTolerance(Number(existing.difference)) ? ', with no difference.' : `, with a difference of ${fmt2(Number(existing.difference))}.`}
        </div>
      )}

      {pendingMatches > 0 && (
        <div className="note" style={{ color: 'var(--amber)', fontWeight: 600 }}>
          {pendingMatches} line{pendingMatches === 1 ? '' : 's'} matched to the statement {pendingMatches === 1 ? 'is' : 'are'} not ticked yet. Tick {pendingMatches === 1 ? 'it' : 'them'} first.
        </div>
      )}

      {!entered && <div className="note">Enter the closing balance from the statement above, then press Done.</div>}

      {needsNote && (
        <div className="field" style={{ maxWidth: 520 }}>
          <label htmlFor="signoff-note">There is still a difference of {fmt2(summary.difference)}. What explains it?</label>
          <input id="signoff-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: bank charges to be entered next week" />
        </div>
      )}

      <Button type="button" onClick={() => void done()} disabled={!canSave}>
        {busy ? 'Saving…' : existing ? 'Done: save again' : 'Done: save this reconciliation'}
      </Button>

      {signoffs && signoffs.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>Saved reconciliations for {bankName}</h4>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>As at</th>
                  <th style={{ textAlign: 'right' }}>Statement balance</th>
                  <th style={{ textAlign: 'right' }}>Difference</th>
                  <th>Saved by</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {signoffs.slice(0, 12).map((s) => {
                  const st = signoffStatus(s, ledger)
                  return (
                    <tr key={s.id}>
                      <td>{fmtDate(s.statement_date)}</td>
                      <td className="amt">{fmt2(Number(s.statement_balance))}</td>
                      <td className="amt" style={{ color: withinTolerance(Number(s.difference)) ? undefined : 'var(--red)' }}>
                        {fmt2(Number(s.difference))}
                        {s.note && <div className="retention-note">{s.note}</div>}
                      </td>
                      <td>
                        {nameOf(s.completed_by)}
                        <div className="retention-note">{fmtDate(s.completed_at.slice(0, 10))}</div>
                      </td>
                      <td style={{ color: st.upToDate ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {st.upToDate ? 'Up to date' : `Books changed since (now ${fmt2(st.bookBalanceNow)})`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn danger-link" onClick={() => void reopen(s.id, s.statement_date)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
