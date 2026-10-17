import { useCallback, useRef, useState, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'
import { useProfiles } from '../lib/queries/admin'
import { earlierAmountsForSubHead, findPossibleDuplicates } from '../lib/queries/duplicates'
import { amountWarning, dateWarnings, type DuplicateMatch, type SaveWarning } from '../lib/saveChecks'
import { fmt, fmtDate } from '../lib/calc/format'

export interface SaveCheckInput {
  /** The sentence the person reads, e.g. "Expense ₹5,000 · 15 Oct · Project: X". */
  sentence: string
  amount: number
  date: string
  /** People linked to the entry: who enters it, on whose behalf, who is reimbursed. */
  personIds: string[]
  /** For the "unusually large" check. */
  subHeadId?: string | null
}

export interface SaveDecision {
  ok: boolean
  /** Set when the person saved even though a possible duplicate was found. */
  duplicateReason?: string
}

interface Pending {
  input: SaveCheckInput
  warnings: SaveWarning[]
  duplicates: DuplicateMatch[]
  resolve: (d: SaveDecision) => void
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Before an entry is saved: runs the checks, then shows what is about to be saved in one plain sentence, with any warnings and any
 * possible duplicates. Duplicates warn but never block: saving anyway needs a reason. Render `dialog` anywhere in the form. */
export function useSaveConfirm(): { ask: (input: SaveCheckInput) => Promise<SaveDecision>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null)
  const busy = useRef(false)

  const ask = useCallback(async (input: SaveCheckInput): Promise<SaveDecision> => {
    if (busy.current) return { ok: false }
    busy.current = true
    try {
      const [duplicates, earlier] = await Promise.all([
        findPossibleDuplicates({ amount: input.amount, date: input.date, personIds: input.personIds }),
        input.subHeadId ? earlierAmountsForSubHead(input.subHeadId) : Promise.resolve([] as number[]),
      ])
      const warnings = [...dateWarnings(input.date, todayIso()), ...amountWarning(input.amount, earlier)]
      return await new Promise<SaveDecision>((resolve) => setPending({ input, warnings, duplicates, resolve }))
    } finally {
      busy.current = false
    }
  }, [])

  const dialog = pending ? (
    <SaveConfirmDialog
      pending={pending}
      onAnswer={(d) => {
        pending.resolve(d)
        setPending(null)
      }}
    />
  ) : null

  return { ask, dialog }
}

function SaveConfirmDialog({ pending, onAnswer }: { pending: Pending; onAnswer: (d: SaveDecision) => void }) {
  const { data: profiles } = useProfiles()
  const [reason, setReason] = useState('')
  const hasDuplicates = pending.duplicates.length > 0
  const nameOf = (id: string | null) => profiles?.find((p) => p.id === id)?.name ?? '—'

  return (
    <Modal title="Save this entry?" onClose={() => onAnswer({ ok: false })}>
      <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>{pending.input.sentence}</p>

      {pending.warnings.map((w) => (
        <div key={w.kind} className="save-warning">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>{w.message}</span>
        </div>
      ))}

      {hasDuplicates && (
        <div className="save-duplicates">
          <div className="save-warning">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              Possible duplicate: the same amount, within 2 days, for the same person already exists. If this is a different payment, save anyway with a reason.
            </span>
          </div>
          <table className="data table-compact">
            <thead>
              <tr>
                <th>Module</th>
                <th>Date</th>
                <th className="amt">Amount</th>
                <th>Entered by</th>
              </tr>
            </thead>
            <tbody>
              {pending.duplicates.map((d, i) => (
                <tr key={`${d.module}-${d.displayId}-${i}`}>
                  <td>
                    {d.module}
                    {d.displayId ? ` · ${d.displayId}` : ''}
                  </td>
                  <td>{fmtDate(d.date)}</td>
                  <td className="amt">{fmt(d.amount)}</td>
                  <td>{nameOf(d.enteredBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="dup-reason">Reason for saving anyway</label>
            <input id="dup-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: a second, separate payment" />
          </div>
        </div>
      )}

      <div className="save-actions">
        <Button type="button" variant="secondary" onClick={() => onAnswer({ ok: false })}>
          Cancel
        </Button>
        <Button
          type="button"
          autoFocus={!hasDuplicates}
          disabled={hasDuplicates && !reason.trim()}
          onClick={() => onAnswer({ ok: true, duplicateReason: hasDuplicates ? reason.trim() : undefined })}
        >
          {hasDuplicates ? 'Save anyway' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}
