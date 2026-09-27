import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Partner } from '../lib/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  partner: Partner | null
  // null while still checking; only meaningful once profile.role === 'subscriber'
  hasActiveSubscription: boolean | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(p as Profile | null)

    if (p && (p.role === 'partner')) {
      const { data: staff } = await supabase
        .from('partner_staff')
        .select('partner_id')
        .eq('profile_id', uid)
        .maybeSingle()
      if (staff?.partner_id) {
        const { data: partnerRow } = await supabase.from('partners').select('*').eq('id', staff.partner_id).maybeSingle()
        setPartner(partnerRow as Partner | null)
      }
    } else {
      setPartner(null)
    }

    // Gates access to the subscriber dashboard (SubscriberShell) — a
    // brand-new signup or a lapsed renewal both land here as false until
    // a payment is confirmed, matching every other payment on the
    // platform (manually confirmed by the team, checked again on next load).
    if (p && p.role === 'subscriber') {
      const { data: subs } = await supabase.from('subscriptions').select('status, expires_at').eq('subscriber_id', uid)
      const active = (subs ?? []).some((s) => s.status === 'active' && (!s.expires_at || new Date(s.expires_at) > new Date()))
      setHasActiveSubscription(active)
    } else {
      setHasActiveSubscription(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // RequireRole treats "user but no profile yet" as logged-out and bounces
    // back to the login screen — fine right after a hard reload (loading
    // above covers it), but a login itself fires this listener too, and its
    // loadProfile() is a separate in-flight fetch loading never tracked.
    // Without gating on it here, the freshly-authenticated user could render
    // through RequireRole with profile still null and get bounced straight
    // back to the form they just submitted, no error, session already valid
    // underneath — they'd just see their own login page again and re-enter
    // everything, thinking nothing happened.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        // Only SIGNED_IN needs the gate — TOKEN_REFRESHED fires routinely
        // in the background on an already-open session (hourly, or on tab
        // refocus) and would otherwise flash the full-screen spinner over
        // whatever the person is doing every time it does.
        if (event === 'SIGNED_IN') {
          setLoading(true)
          loadProfile(newSession.user.id).finally(() => setLoading(false))
        } else {
          loadProfile(newSession.user.id)
        }
      } else {
        setProfile(null)
        setPartner(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setPartner(null)
    setHasActiveSubscription(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, profile, partner, hasActiveSubscription, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
