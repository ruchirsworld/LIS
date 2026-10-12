import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches a crash in any screen so the user sees a way forward instead of a white page. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card" role="alert" style={{ margin: '40px auto', maxWidth: 460, padding: 24, textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px' }}>This page hit a problem</h3>
        <p className="note" style={{ margin: '0 0 16px' }}>
          Nothing you saved is lost. Reload to try again, or pick another page from the menu. If it keeps happening, tell the admin what you were doing.
        </p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}

/** Shown while a page's code loads or the session is being restored. */
export function PageLoading() {
  return (
    <div className="note" role="status" aria-live="polite" style={{ padding: '60px 16px', textAlign: 'center' }}>
      Loading…
    </div>
  )
}
