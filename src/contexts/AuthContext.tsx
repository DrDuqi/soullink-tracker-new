import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useRunStore } from '../store/runStore'
import type { Profile } from '../types/database'

interface AuthResult { error?: string }

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthCtx = createContext<AuthState | undefined>(undefined)

// Map Supabase auth errors to friendly German messages.
function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) return 'Diese E-Mail ist bereits registriert.'
  if (m.includes('invalid login')) return 'E-Mail oder Passwort ist falsch.'
  if (m.includes('password') && m.includes('6')) return 'Das Passwort muss mindestens 6 Zeichen lang sein.'
  if (m.includes('email') && m.includes('valid')) return 'Bitte eine gültige E-Mail-Adresse eingeben.'
  if (m.includes('rate limit')) return 'Zu viele Versuche. Bitte kurz warten.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
    // Best-effort "last seen" touch (ignore failures).
    void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('user_id', userId)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) loadProfile(data.session.user.id).finally(() => active && setLoading(false))
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthResult> => {
    const uname = username.trim()
    if (uname.length < 3) return { error: 'Der Benutzername muss mindestens 3 Zeichen lang sein.' }

    // Pre-check uniqueness (case-insensitive) for a clean message before sign-up.
    const { data: taken } = await supabase.from('profiles').select('user_id').ilike('username', uname).maybeSingle()
    if (taken) return { error: 'Benutzername ist bereits vergeben.' }

    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) return { error: mapAuthError(error.message) }
    const user = data.user
    if (!user) return { error: 'Registrierung fehlgeschlagen. Bitte erneut versuchen.' }

    const { error: profErr } = await supabase.from('profiles').insert({
      user_id: user.id, username: uname, display_name: uname,
    })
    if (profErr) {
      if (profErr.code === '23505') return { error: 'Benutzername ist bereits vergeben.' }
      return { error: 'Profil konnte nicht erstellt werden: ' + profErr.message }
    }
    await loadProfile(user.id)
    return {}
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { error: mapAuthError(error.message) }
    if (data.user) await loadProfile(data.user.id)
    return {}
  }, [loadProfile])

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) return { error: mapAuthError(error.message) }
    return {}
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    // Clear any cached run identity + legacy free-name identity.
    useRunStore.getState().clearRun()
    try {
      localStorage.removeItem('soullink-run')
      localStorage.removeItem('soullink_player_name')
    } catch { /* ignore */ }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
