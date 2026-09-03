import { Button } from './ui'
import { useAuth } from '../lib/auth'
import type { LocationPingResult } from '../lib/workStore'
import laavinLogo from '../assets/laavin-logo.jpg'

// Blocks the entire app for a Supervisor until location access is granted —
// GPS is mandatory for that role, not an optional nicety, so there's no
// "skip for now" here. The browser won't re-prompt once denied, so this
// screen carries its own Retry action plus a way out (Sign out) for a
// device that genuinely can't grant it.
export function LocationGate({ status, onRetry }: { status: LocationPingResult | 'unknown'; onRetry: () => void }) {
  const { signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', padding: 28, textAlign: 'center' }}>
        <img src={laavinLogo} alt="Laavin InfraScapes" style={{ height: 40, marginBottom: 18, mixBlendMode: 'multiply' }} />
        {status === 'unknown' ? (
          <>
            <h3 style={{ margin: '0 0 8px' }}>Checking location access…</h3>
            <p className="note" style={{ margin: 0 }}>This only takes a moment.</p>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px' }}>Location access required</h3>
            <p className="note" style={{ margin: '0 0 22px' }}>
              {status === 'denied'
                ? 'This app needs your location to work and can’t continue without it. Location access is currently blocked — enable it for this site in your phone or browser settings, then tap Retry.'
                : 'This app needs your location to work, but your browser doesn’t support location services. Try a different browser, then tap Retry.'}
            </p>
            <Button type="button" onClick={onRetry} style={{ width: '100%', marginBottom: 10 }}>
              Retry
            </Button>
            <Button type="button" variant="link" onClick={() => signOut()}>
              Sign out
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
