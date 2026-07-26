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
import { supabase } from '../utils/supabase'

type AuthStatus =
  | 'loading'
  | 'signedOut'
  | 'mfa'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'error'
type AssuranceLevel = string | null

interface AuthMembership {
  id: string
  organizationId: string
}

interface AuthContextValue {
  session: Session | null
  status: AuthStatus
  membership: AuthMembership | null
  mfaBypassed: boolean
  mfaBypassExpiresAt: string | null
  authorizationError: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<string | null>
  refreshAssurance: () => Promise<string | null>
  refreshAccess: () => Promise<string | null>
  retryAuthorization: () => void
}

type MembershipStatus = 'active' | 'suspended' | 'offboarded'
type OnboardingStatus = 'profile' | 'mfa' | 'policies' | 'preferences' | 'complete'

interface MembershipRow {
  id: string
  organization_id: string
  status: MembershipStatus
  starts_at: string
  expires_at: string | null
  onboarding_progress:
    | { status: OnboardingStatus }
    | Array<{ status: OnboardingStatus }>
    | null
}

interface AccessState {
  status: Extract<AuthStatus, 'onboarding' | 'active' | 'suspended' | 'expired'>
  membership: AuthMembership | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>()
  const [assurance, setAssurance] = useState<AssuranceLevel>()
  const [access, setAccess] = useState<AccessState | null>()
  const [mfaBypassExpiresAt, setMfaBypassExpiresAt] = useState<string | null>(null)
  const [authorizationError, setAuthorizationError] = useState<string | null>(null)

  const refreshAssurance = useCallback(async () => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) {
      setAssurance(null)
      setAuthorizationError(error.message)
      return error.message
    }

    let developmentBypassExpiresAt: string | null = null
    if (
      data.currentLevel !== 'aal2'
      && import.meta.env.VITE_ENABLE_MFA_BYPASS === 'true'
    ) {
      const bypass = await supabase.rpc('begin_development_mfa_bypass')
      if (
        !bypass.error
        && typeof bypass.data === 'string'
        && Date.parse(bypass.data) > Date.now()
      ) {
        developmentBypassExpiresAt = bypass.data
      }
    }

    setAuthorizationError(null)
    setAssurance(data.currentLevel)
    setMfaBypassExpiresAt(developmentBypassExpiresAt)
    return null
  }, [])

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
        expires_at,
        onboarding_progress(status)
      `)
      .eq('user_id', session.user.id)

    if (error) {
      setAccess(null)
      setAuthorizationError(error.message)
      return error.message
    }

    setAuthorizationError(null)
    setAccess(classifyAccess((data ?? []) as MembershipRow[]))
    return null
  }, [session])

  useEffect(() => {
    let mounted = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setAssurance(nextSession ? undefined : null)
      setAccess(nextSession ? undefined : null)
      setMfaBypassExpiresAt(null)
      setAuthorizationError(null)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAssurance(data.session ? undefined : null)
      setAccess(data.session ? undefined : null)
      setMfaBypassExpiresAt(null)
      setAuthorizationError(null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || assurance !== undefined) return
    void refreshAssurance()
  }, [assurance, refreshAssurance, session])

  const mfaBypassed = (
    assurance !== 'aal2'
    && mfaBypassExpiresAt !== null
  )
  const mfaSatisfied = assurance === 'aal2' || mfaBypassed

  useEffect(() => {
    if (!session || !mfaSatisfied || access !== undefined) return
    void refreshAccess()
  }, [access, mfaSatisfied, refreshAccess, session])

  useEffect(() => {
    if (!mfaBypassExpiresAt) return
    const remaining = Date.parse(mfaBypassExpiresAt) - Date.now()
    if (remaining <= 0) {
      setMfaBypassExpiresAt(null)
      setAccess(undefined)
      return
    }
    const timeout = window.setTimeout(() => {
      setMfaBypassExpiresAt(null)
      setAccess(undefined)
    }, Math.min(remaining, 2_147_483_647))
    return () => window.clearTimeout(timeout)
  }, [mfaBypassExpiresAt])

  const status: AuthStatus =
    session === undefined
      ? 'loading'
      : !session
        ? 'signedOut'
        : authorizationError
          ? 'error'
          : assurance === undefined
            ? 'loading'
            : !mfaSatisfied
              ? 'mfa'
              : access === undefined
                ? 'loading'
                : access?.status ?? 'suspended'

  const value = useMemo<AuthContextValue>(() => ({
    session: session ?? null,
    status,
    membership: access?.membership ?? null,
    mfaBypassed,
    mfaBypassExpiresAt,
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
    refreshAssurance,
    refreshAccess,
    retryAuthorization: () => {
      setAuthorizationError(null)
      setAssurance(undefined)
      setAccess(undefined)
      setMfaBypassExpiresAt(null)
    },
  }), [
    access,
    authorizationError,
    mfaBypassed,
    mfaBypassExpiresAt,
    refreshAccess,
    refreshAssurance,
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
    const progress = Array.isArray(activeMembership.onboarding_progress)
      ? activeMembership.onboarding_progress[0]
      : activeMembership.onboarding_progress
    return {
      status: progress?.status === 'complete' ? 'active' : 'onboarding',
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
