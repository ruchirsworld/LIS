import { useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { Button, StatusTag } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { fmtDate } from '../../lib/calc/format'
import { useLockActions, useReconAudit, useReconLock } from '../../lib/queries/recon'
import { useProfiles } from '../../lib/queries/admin'
import { useAuth } from '../../lib/auth'
import { getErrorMessage } from '../../lib/errors'
import { confirmAction, toast } from '../../lib/feedback'

const ACTION_TEXT: Record<string, string> = {
  match: 'Matched',
  group: 'Matched as a group',
  unmatch: 'Unmatched',
  ungroup: 'Group taken apart',
  match_broken: 'Match broken',
  lock: 'Period locked',
  unlock: 'Unlocked for editing',
  lock_removed: 'Lock removed',
}

const timeText = (iso: string) => `${fmtDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`

/** Locks a reconciled period and shows what has been done in this reconciliation, with who and when. */
export function ReconLockPanel({ bankId, defaultLockDate }: { bankId: string; defaultLockDate: string }) {
  const { profile } = useAuth()
  const { data: profiles } = useProfiles()
  const { data: lock } = useReconLock(bankId)
  const { data: audit } = useReconAudit(bankId)
  const actions = useLockActions(bankId)
  const canLock = profile?.role === 'admin' || profile?.role === 'cxo'
  const isAdmin = profile?.role === 'admin'
  const [until, setUntil] = useState(defaultLockDate)
  const [dialog, setDialog] = useState<'unlock' | 'release' | null>(null)
  const [reason, setReason] = useState('')

  const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')
  const unlocked = !!lock?.override_until && new Date(lock.override_until) > new Date()

  async function doLock() {
    const ok = await confirmAction({
      title: 'Lock this period?',
      message: `Entries on this account dated up to ${fmtDate(until)} can no longer be added, changed or removed, unless an admin unlocks it with a reason.`,
      confirmLabel: 'Lock',
    })
    if (!ok) return
    try {
      await actions.lock.mutateAsync(until)
      toast('success', `Locked up to ${fmtDate(until)}.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not lock.'))
    }
  }

  async function submitReason() {
    try {
      if (dialog === 'unlock') await actions.unlock.mutateAsync({ reason })
      else await actions.release.mutateAsync(reason)
      toast('success', dialog === 'unlock' ? 'Unlocked for 30 minutes. It locks again by itself.' : 'The lock was removed.')
      setDialog(null)
      setReason('')
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not do that.'))
    }
  }

  return (
    <details className="toggle-section recon-lock">
      <summary>
        Lock and history {lock ? <StatusTag kind={unlocked ? 'pending' : 'success'}>{unlocked ? 'Unlocked for editing' : `Locked up to ${fmtDate(lock.locked_until)}`}</StatusTag> : null}
      </summary>
      <div className="recon-lock-body">
        {lock ? (
          <div className="recon-lock-row">
            <Lock size={16} aria-hidden="true" />
            <span>
              Locked up to <strong>{fmtDate(lock.locked_until)}</strong>.
              {unlocked && lock.override_until ? ` Open for editing until ${new Date(lock.override_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} (${lock.override_reason}).` : ''}
            </span>
            {isAdmin && (
              <>
                <Button type="button" variant="secondary" onClick={() => setDialog('unlock')}>
                  <LockOpen size={14} aria-hidden="true" /> Unlock to edit
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDialog('release')}>
                  Remove lock
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="note" style={{ margin: 0 }}>Not locked. Once a period is fully matched, lock it so its entries cannot change by accident.</div>
        )}
        {canLock && (
          <div className="recon-lock-row">
            <div className="field" style={{ maxWidth: 190 }}>
              <label htmlFor="lock-until">Lock entries up to</label>
              <input id="lock-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void doLock()} disabled={actions.lock.isPending || !until}>
              Lock
            </Button>
            <span className="note" style={{ margin: 0 }}>Every entry up to that date must be matched first.</span>
          </div>
        )}

        <div className="recon-history">
          <div className="note" style={{ fontWeight: 600 }}>What has been done</div>
          {(audit ?? []).length === 0 && <div className="note">Nothing yet.</div>}
          {(audit ?? []).slice(0, 40).map((a) => (
            <div key={a.id} className="recon-history-row">
              <span className="recon-history-when">{timeText(a.at)}</span>
              <span>
                {ACTION_TEXT[a.action] ?? a.action}
                {a.group_ref ? ` ${a.group_ref}` : ''}
                {a.reason ? ` · ${a.reason}` : ''}
              </span>
              <span className="note" style={{ margin: 0 }}>{a.action === 'match_broken' ? 'an entry was changed' : nameOf(a.by_user)}</span>
            </div>
          ))}
        </div>
      </div>

      {dialog && (
        <Modal title={dialog === 'unlock' ? 'Unlock this period to edit' : 'Remove the lock'} onClose={() => setDialog(null)}>
          <div className="field">
            <label htmlFor="lock-reason">Reason (kept in the history)</label>
            <input id="lock-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: wrong amount found on a payment" />
          </div>
          <div className="save-actions">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={reason.trim().length < 3} onClick={() => void submitReason()}>
              {dialog === 'unlock' ? 'Unlock for 30 minutes' : 'Remove lock'}
            </Button>
          </div>
        </Modal>
      )}
    </details>
  )
}
