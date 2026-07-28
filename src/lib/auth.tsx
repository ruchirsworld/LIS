import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Profile {
  id: string
  name: string
  role: 'admin' | 'cxo' | 'staff'
  phone: string | null
  employee_id: string | null
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Supabase fires onAuthStateChange (with a new Session object) on silent
  // token refreshes too — e.g. whenever the tab regains focus — not just on
  // actual sign-in/out. Only refetch the profile (and gate the app behind
  // `loading`) when the signed-in user actually changes, so a background
  // token refresh doesn't unmount the app and reset in-page navigation state.
  const loadedUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    if (!session) {
      loadedUserId.current = null
      setProfile(null)
      setLoading(false)
      return
    }

    if (session.user.id === loadedUserId.current) {
      return
    }

    setLoading(true)
    supabase
      .from('profiles')
      .select('id, name, role, phone, employee_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfile(null)
        } else {
          setProfile(data as Profile)
          loadedUserId.current = session.user.id
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
