import { useEffect, useState } from 'react'
import { Button } from './ui'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// Chrome only fires `beforeinstallprompt` once its own installability
// criteria are met (valid manifest + service worker + a secure origin —
// this silently never fires at all on plain HTTP, e.g. testing over the
// local network before the app is deployed) — and even then, waits on its
// own engagement heuristics. This gives people a dependable manual trigger
// instead of hoping that banner shows up on its own. iOS Safari doesn't
// support this event at all, so it gets a plain instruction instead.
export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function handleInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (installed) return null
  if (!deferredPrompt && !isIos()) return null

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return
    }
    setShowIosHint(true)
  }

  return (
    <div style={{ padding: '0 22px 10px' }}>
      <Button type="button" variant="secondary" onClick={handleClick} style={{ width: '100%', fontSize: 12 }}>
        Install app
      </Button>
      {showIosHint && (
        <div className="note" style={{ marginTop: 6 }}>
          Tap the Share icon, then "Add to Home Screen".{' '}
          <button type="button" className="btn link" onClick={() => setShowIosHint(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
