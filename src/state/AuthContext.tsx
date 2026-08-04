import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import i18n from '../i18n'
import { supabase } from '../utils/supabase'

type AuthStatus =
  | 'loading'
  | 'signedOut'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'error'

interface AuthMembership {
  id: string
  organizationId: string
}

interface AuthContextValue {
  session: Session | null
  status: AuthStatus
  membership: AuthMembership | null
  authorizationError: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<string | null>
  refreshAccess: () => Promise<string | null>
  retryAuthorization: () => void
}

type MembershipStatus = 'active' | 'suspended' | 'offboarded'

interface MembershipRow {
  id: string
  organization_id: string
  status: MembershipStatus
  starts_at: string
  expires_at: string | null
}

interface AccessState {
  status: Extract<AuthStatus, 'onboarding' | 'active' | 'suspended' | 'expired'>
  membership: AuthMembership | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>()
  const [access, setAccess] = useState<AccessState | null>()
  const [authorizationError, setAuthorizationError] = useState<string | null>(null)

  const refreshAccess = useCallback(async () => {
    if (!session) {
      setAccess(null)
      return null
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        organization_id,
        status,
        starts_at,
        expires_at
      `)
      .eq('user_id', session.user.id)

    if (error) {
      setAccess(null)
      setAuthorizationError(error.message)
      return error.message
    }

    setAuthorizationError(null)
    const nextAccess = classifyAccess((data ?? []) as MembershipRow[])
    setAccess(nextAccess)
    if (nextAccess.status === 'active') {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('locale')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile?.locale === 'en-US' || profile?.locale === 'vi-VN') {
          await i18n.changeLanguage(profile.locale)
        }
      } catch {
        // Locale loading must not invalidate an otherwise authorized session.
      }
    }
    return null
  }, [session])

  useEffect(() => {
    let mounted = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setAccess(nextSession ? undefined : null)
      setAuthorizationError(null)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAccess(data.session ? undefined : null)
      setAuthorizationError(null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || access !== undefined) return
    void refreshAccess()
  }, [access, refreshAccess, session])

  const status: AuthStatus =
    session === undefined
      ? 'loading'
      : !session
        ? 'signedOut'
        : authorizationError
          ? 'error'
          : access === undefined
            ? 'loading'
            : access?.status ?? 'suspended'

  const value = useMemo<AuthContextValue>(() => ({
    session: session ?? null,
    status,
    membership: access?.membership ?? null,
    authorizationError,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return error?.message ?? null
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      return error?.message ?? null
    },
    refreshAccess,
    retryAuthorization: () => {
      setAuthorizationError(null)
      setAccess(undefined)
    },
  }), [
    access,
    authorizationError,
    refreshAccess,
    session,
    status,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function classifyAccess(rows: MembershipRow[]): AccessState {
  const now = Date.now()
  const activeMembership = rows.find((row) => (
    row.status === 'active'
    && Date.parse(row.starts_at) <= now
    && (row.expires_at === null || Date.parse(row.expires_at) > now)
  ))

  if (activeMembership) {
    return {
      status: 'active',
      membership: {
        id: activeMembership.id,
        organizationId: activeMembership.organization_id,
      },
    }
  }

  const suspendedMembership = rows.find((row) => row.status === 'suspended')
  if (suspendedMembership) {
    return {
      status: 'suspended',
      membership: {
        id: suspendedMembership.id,
        organizationId: suspendedMembership.organization_id,
      },
    }
  }

  return {
    status: 'expired',
    membership: rows[0]
      ? {
          id: rows[0].id,
          organizationId: rows[0].organization_id,
        }
      : null,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

// Preview providers can run without creating a synthetic authenticated session.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalAuth() {
  return useContext(AuthContext)
}
