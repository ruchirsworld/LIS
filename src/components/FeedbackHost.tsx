import { useEffect, useRef, useState } from 'react'
import { onConfirm, onToast, type ConfirmRequest, type ToastItem } from '../lib/feedback'
import { Button } from './ui'
import './FeedbackHost.css'

const TOAST_MS: Record<ToastItem['kind'], number> = { success: 3000, info: 4000, error: 7000 }

/** Draws toasts and the confirm dialog. Mounted once, near the top of the app. */
export function FeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () =>
      onToast((t) => {
        setToasts((cur) => [...cur.filter((x) => x.message !== t.message).slice(-3), t])
        window.setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), TOAST_MS[t.kind])
      }),
    []
  )

  useEffect(() => onConfirm((r) => setRequest(r)), [])

  useEffect(() => {
    if (!request) return
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') answer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  function answer(ok: boolean) {
    request?.resolve(ok)
    setRequest(null)
  }

  return (
    <>
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
      {request && (
        <div className="modal-backdrop" onClick={() => answer(false)}>
          <div className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong id="confirm-title">{request.title}</strong>
            </div>
            <div className="modal-body">
              <p className="confirm-message">{request.message}</p>
              <div className="confirm-actions">
                <Button type="button" variant="secondary" onClick={() => answer(false)}>
                  Cancel
                </Button>
                <button ref={confirmRef} type="button" className={request.danger ? 'btn danger' : 'btn'} onClick={() => answer(true)}>
                  {request.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
