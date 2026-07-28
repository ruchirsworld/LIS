import { useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { Button } from '../../components/ui'
import { phoneToSyntheticEmail, looksLikePhone } from '../../lib/phoneAuth'
import { APP_VERSION } from '../../lib/version'
import laavinLogo from '../../assets/laavin-logo.jpg'

export function LoginPage() {
  const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const email = looksLikePhone(identifier) ? phoneToSyntheticEmail(identifier) : identifier
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src={laavinLogo}
          alt="Laavin InfraScapes"
          style={{ height: 56, width: 'auto', marginBottom: 12, mixBlendMode: 'multiply' }}
        />
        <div className="note" style={{ marginBottom: 20, fontSize: 13 }}>
          Sign in to continue
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div className="field">
          <label htmlFor="login-identifier">Phone or email</label>
          <input
            id="login-identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password / PIN</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
      </form>
      <div className="note" style={{ textAlign: 'center', marginTop: 16, fontSize: 11 }}>
        {APP_VERSION}
      </div>
    </div>
  )
}
