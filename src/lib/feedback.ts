// One place for the two things every screen needs to tell the user: a short
// message that something happened (toast), and a question that needs a yes/no
// before something irreversible (confirmAction). Plain functions, so they work
// from query code and event handlers alike; FeedbackHost (mounted once in App)
// is what actually draws them.

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** A button on the toast, e.g. Undo. The toast stays for 10 seconds when it has one. */
  action?: ToastAction
}

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  /** Red confirm button, for deletes and anything that cannot be undone. */
  danger?: boolean
  resolve: (ok: boolean) => void
}

type ToastListener = (t: ToastItem) => void
type ConfirmListener = (r: ConfirmRequest) => void

const toastListeners = new Set<ToastListener>()
const confirmListeners = new Set<ConfirmListener>()
let nextId = 1

export function onToast(fn: ToastListener): () => void {
  toastListeners.add(fn)
  return () => toastListeners.delete(fn)
}

export function onConfirm(fn: ConfirmListener): () => void {
  confirmListeners.add(fn)
  return () => confirmListeners.delete(fn)
}

export function toast(kind: ToastKind, message: string, options?: ToastOptions): void {
  const item: ToastItem = { id: nextId++, kind, message, action: options?.action }
  toastListeners.forEach((fn) => fn(item))
}

/** Resolves true if the user confirms. With no host mounted it falls back to the browser prompt. */
export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  if (confirmListeners.size === 0) return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message}`))
  return new Promise((resolve) => {
    const req: ConfirmRequest = { ...opts, resolve }
    confirmListeners.forEach((fn) => fn(req))
  })
}
